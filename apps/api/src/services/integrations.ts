import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { toMinutes, type IntegrationDto, type SyncResultDto } from '@tc/core';
import { IntegrationError, createStravaClient, type ActivitySource, type NormalizedActivity } from '@tc/integrations';
import { decrypt, encrypt, signState, verifyState } from '../crypto';
import { db } from '../db/client';
import { activity, integration, plannedSession } from '../db/schema';
import { env } from '../env';

/** How far back the first sync looks. */
const FIRST_SYNC_DAYS = 60;

const configured = () => !!(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET);
let client: ActivitySource | undefined;

function strava(): ActivitySource {
  if (!configured()) throw new HTTPException(503, { message: 'Strava is not set up on this server (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET).' });
  return (client ??= createStravaClient({ clientId: env.STRAVA_CLIENT_ID!, clientSecret: env.STRAVA_CLIENT_SECRET! }));
}

export const stravaRedirectUri = () => `${env.APP_URL}/api/v1/integrations/strava/callback`;

export async function listIntegrations(athleteId: string): Promise<IntegrationDto[]> {
  const [row] = await db.select().from(integration).where(and(eq(integration.athleteId, athleteId), eq(integration.provider, 'strava')));
  const activityCount = await db.$count(activity, and(eq(activity.athleteId, athleteId), eq(activity.provider, 'strava')));
  return [{
    provider: 'strava',
    available: configured(),
    connected: !!row,
    lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
    activityCount,
  }];
}

export function startStravaConnect(athleteId: string, userId: string) {
  return strava().authorizeUrl({ redirectUri: stravaRedirectUri(), state: signState({ aid: athleteId, uid: userId }) });
}

type CallbackQuery = { code?: string; state?: string; scope?: string; error?: string };

/** Checks the OAuth callback came from a connect flow this user started. Returns the athlete id. */
export function verifyStravaCallback(userId: string, q: CallbackQuery): string {
  if (q.error) throw new HTTPException(400, { message: 'Strava access was not granted.' });
  const state = q.state ? verifyState(q.state) : null;
  if (!state || state.uid !== userId || !state.aid || !q.code) throw new HTTPException(400, { message: 'Invalid or expired Strava login. Please try again.' });
  if (!q.scope?.split(',').some((s) => s.startsWith('activity:read'))) {
    throw new HTTPException(400, { message: 'Please allow Tempo to view your activities on Strava.' });
  }
  return state.aid;
}

/** Exchanges the code and stores the (encrypted) tokens. Call after verifyStravaCallback + authorization. */
export async function completeStravaConnect(athleteId: string, userId: string, code: string) {
  const t = await strava().exchangeCode(code);
  const [taken] = await db
    .select({ athleteId: integration.athleteId })
    .from(integration)
    .where(and(eq(integration.provider, 'strava'), eq(integration.externalUserId, t.externalUserId!), ne(integration.athleteId, athleteId)));
  if (taken) throw new HTTPException(409, { message: 'This Strava account is already connected to another profile.' });

  const values = {
    externalUserId: t.externalUserId!,
    accessTokenEnc: encrypt(t.accessToken),
    refreshTokenEnc: encrypt(t.refreshToken),
    expiresAt: t.expiresAt,
    connectedBy: userId,
    lastError: null,
  };
  await db
    .insert(integration)
    .values({ athleteId, provider: 'strava', ...values })
    .onConflictDoUpdate({ target: [integration.athleteId, integration.provider], set: values });
}

async function accessToken(athleteId: string) {
  const [row] = await db.select().from(integration).where(and(eq(integration.athleteId, athleteId), eq(integration.provider, 'strava')));
  if (!row) throw new HTTPException(404, { message: 'Strava is not connected' });
  if (row.expiresAt.getTime() > Date.now() + 5 * 60_000) return decrypt(row.accessTokenEnc);
  const t = await strava().refresh(decrypt(row.refreshTokenEnc));
  await db
    .update(integration)
    .set({ accessTokenEnc: encrypt(t.accessToken), refreshTokenEnc: encrypt(t.refreshToken), expiresAt: t.expiresAt })
    .where(and(eq(integration.athleteId, athleteId), eq(integration.provider, 'strava')));
  return t.accessToken;
}

export async function disconnectStrava(athleteId: string) {
  try {
    await strava().revoke(await accessToken(athleteId));
  } catch {
    // Revoking is best effort: the user may already have removed access on Strava.
  }
  await db.delete(integration).where(and(eq(integration.athleteId, athleteId), eq(integration.provider, 'strava')));
}

export async function syncStrava(athleteId: string): Promise<SyncResultDto> {
  const where = and(eq(integration.athleteId, athleteId), eq(integration.provider, 'strava'));
  try {
    const token = await accessToken(athleteId);
    const [last] = await db
      .select({ startAt: activity.startAt })
      .from(activity)
      .where(and(eq(activity.athleteId, athleteId), eq(activity.provider, 'strava')))
      .orderBy(desc(activity.startAt))
      .limit(1);
    // Overlap by a day so activities uploaded late (e.g. after a long trip) are not missed.
    const after = last ? new Date(last.startAt.getTime() - 86_400_000) : new Date(Date.now() - FIRST_SYNC_DAYS * 86_400_000);
    const result = await importActivities(athleteId, await strava().listActivities(token, { after }));
    await db.update(integration).set({ lastSyncAt: new Date(), lastError: null }).where(where);
    return result;
  } catch (e) {
    if (e instanceof IntegrationError) {
      await db.update(integration).set({ lastError: e.message }).where(where);
      throw new HTTPException(e.code === 'rate_limited' ? 429 : 502, { message: e.message });
    }
    throw e;
  }
}

/**
 * Stores new activities and links each one to the planned session it fulfilled:
 * same day and sport, not yet linked, closest start time. Unplanned activities become `import` sessions.
 * Already imported activities are left alone, so re-syncing is safe.
 */
export async function importActivities(athleteId: string, list: NormalizedActivity[]): Promise<SyncResultDto> {
  const result: SyncResultDto = { imported: 0, matched: 0, created: 0 };
  for (const a of list) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(activity)
        .values({ athleteId, provider: a.provider, externalId: a.externalId, sportId: a.sport, name: a.name, startAt: a.startAt,
          localDate: a.localDate, localTime: a.localTime, movingSec: a.movingSec, elapsedSec: a.elapsedSec, distanceM: a.distanceM,
          elevationGainM: a.elevationGainM, avgHr: a.avgHr, maxHr: a.maxHr, avgWatts: a.avgWatts, normalizedWatts: a.normalizedWatts,
          avgSpeed: a.avgSpeed })
        .onConflictDoNothing()
        .returning({ id: activity.id });
      if (!row) return;
      result.imported++;

      const candidates = await tx
        .select({ id: plannedSession.id, time: plannedSession.time, completedAt: plannedSession.completedAt })
        .from(plannedSession)
        .leftJoin(activity, eq(activity.sessionId, plannedSession.id))
        .where(and(
          eq(plannedSession.athleteId, athleteId),
          eq(plannedSession.date, a.localDate),
          eq(plannedSession.sportId, a.sport),
          ne(plannedSession.source, 'import'),
          isNull(activity.id),
        ))
        .orderBy(asc(plannedSession.time));
      const start = toMinutes(a.localTime);
      const best = candidates.sort((x, y) => Math.abs(toMinutes(x.time) - start) - Math.abs(toMinutes(y.time) - start))[0];
      const doneAt = new Date(a.startAt.getTime() + a.elapsedSec * 1000);

      let sessionId: string;
      if (best) {
        sessionId = best.id;
        if (!best.completedAt) await tx.update(plannedSession).set({ completedAt: doneAt }).where(eq(plannedSession.id, best.id));
        result.matched++;
      } else {
        const [s] = await tx
          .insert(plannedSession)
          .values({ athleteId, date: a.localDate, time: a.localTime, durationMin: Math.max(1, Math.round(a.movingSec / 60)),
            sportId: a.sport, title: a.name, source: 'import', distanceM: a.distanceM, completedAt: doneAt })
          .returning({ id: plannedSession.id });
        sessionId = s!.id;
        result.created++;
      }
      await tx.update(activity).set({ sessionId }).where(eq(activity.id, row.id));
    });
  }
  return result;
}
