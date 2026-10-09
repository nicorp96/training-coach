import { afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { IntegrationDto, MeDto, SessionDto, SyncResultDto } from '@tc/core';
import { app } from '../src/app';
import { db } from '../src/db/client';
import { integration } from '../src/db/schema';

const ORIGIN = 'http://localhost:3000';

async function signUp(email: string, name: string) {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password: 'correct-horse-battery', name }),
  });
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const call = (path: string, init: RequestInit = {}) =>
    app.request(`/api/v1${path}`, { ...init, headers: { cookie, origin: ORIGIN, 'content-type': 'application/json', ...init.headers } });
  const me = (await (await call('/me')).json()) as MeDto;
  return { call, athleteId: me.athletes[0]!.id };
}

const stravaRun = {
  id: 9001, name: 'Lunch Run', sport_type: 'Run', start_date: '2026-10-12T05:10:00Z', start_date_local: '2026-10-12T07:10:00Z',
  moving_time: 2700, elapsed_time: 2800, distance: 9000, average_heartrate: 150, max_heartrate: 172, average_speed: 3.33,
};
const stravaRide = {
  id: 9002, name: 'Evening Ride', sport_type: 'Ride', start_date: '2026-10-13T16:00:00Z', start_date_local: '2026-10-13T18:00:00Z',
  moving_time: 5400, elapsed_time: 5600, distance: 45000, average_watts: 180, weighted_average_watts: 195, device_watts: true, average_speed: 8.3,
};

/** Fakes Strava's token and activities endpoints. */
function fakeStrava(athleteId = 777, activities: object[] = [stravaRun, stravaRide]) {
  const fetch = vi.fn(async (url: string) => {
    if (url.includes('/oauth/token')) {
      return Response.json({ access_token: 'acc-123', refresh_token: 'ref-456', expires_at: Math.floor(Date.now() / 1000) + 6 * 3600, athlete: { id: athleteId } });
    }
    if (url.includes('/athlete/activities')) return Response.json(activities);
    if (url.includes('/oauth/deauthorize')) return Response.json({});
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

async function connect(u: Awaited<ReturnType<typeof signUp>>, scope = 'read,activity:read_all') {
  const { url } = (await (await u.call(`/athletes/${u.athleteId}/integrations/strava/connect`, { method: 'POST' })).json()) as { url: string };
  const state = new URL(url).searchParams.get('state')!;
  return u.call(`/integrations/strava/callback?code=abc&scope=${scope}&state=${encodeURIComponent(state)}`);
}

describe('Strava import', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('connects, imports, matches planned sessions and stays idempotent', async () => {
    const u = await signUp('strava@example.com', 'Stra Va');
    const before = (await (await u.call(`/athletes/${u.athleteId}/integrations`)).json()) as IntegrationDto[];
    expect(before[0]).toMatchObject({ provider: 'strava', available: true, connected: false });

    // A planned run at 07:00 on the same day as the Strava run (07:10).
    const planned = (await (await u.call(`/athletes/${u.athleteId}/sessions`, {
      method: 'POST', body: JSON.stringify({ date: '2026-10-12', time: '07:00', durationMin: 45, sport: 'run', title: 'Easy run' }),
    })).json()) as SessionDto;

    fakeStrava();
    const cb = await connect(u);
    expect(cb.status).toBe(302);
    expect(cb.headers.get('location')).toBe(`${ORIGIN}/settings?strava=connected&msg=2`);

    // Tokens are encrypted at rest.
    const [row] = await db.select().from(integration).where(eq(integration.athleteId, u.athleteId));
    expect(row!.accessTokenEnc).not.toContain('acc-123');
    expect(row!.externalUserId).toBe('777');

    const sessions = (await (await u.call(`/athletes/${u.athleteId}/sessions?from=2026-10-12&to=2026-10-13`)).json()) as SessionDto[];
    const run = sessions.find((s) => s.id === planned.id)!;
    expect(run.completedAt).not.toBeNull();
    expect(run.activity).toMatchObject({ name: 'Lunch Run', distanceM: 9000, avgHr: 150, externalUrl: 'https://www.strava.com/activities/9001' });
    const ride = sessions.find((s) => s.sport === 'ride')!;
    expect(ride).toMatchObject({ source: 'import', title: 'Evening Ride', date: '2026-10-13', time: '18:00', durationMin: 90 });
    expect(ride.activity).toMatchObject({ avgWatts: 180, normalizedWatts: 195 });

    const again = (await (await u.call(`/athletes/${u.athleteId}/integrations/strava/sync`, { method: 'POST' })).json()) as SyncResultDto;
    expect(again).toEqual({ imported: 0, matched: 0, created: 0 });

    const after = (await (await u.call(`/athletes/${u.athleteId}/integrations`)).json()) as IntegrationDto[];
    expect(after[0]).toMatchObject({ connected: true, activityCount: 2, lastError: null });

    expect((await u.call(`/athletes/${u.athleteId}/integrations/strava`, { method: 'DELETE' })).status).toBe(204);
    const gone = (await (await u.call(`/athletes/${u.athleteId}/integrations`)).json()) as IntegrationDto[];
    expect(gone[0]).toMatchObject({ connected: false, activityCount: 2 });
  });

  it('rejects tampered state, missing scope and an account used by another profile', async () => {
    const a = await signUp('strava-a@example.com', 'A');
    const b = await signUp('strava-b@example.com', 'B');
    fakeStrava(888);

    const bad = await a.call('/integrations/strava/callback?code=abc&scope=read,activity:read_all&state=forged.sig');
    expect(bad.headers.get('location')).toContain('strava=error');

    const noScope = await connect(a, 'read');
    expect(decodeURIComponent(noScope.headers.get('location')!)).toContain('allow Tempo to view your activities');

    expect((await connect(a)).headers.get('location')).toContain('strava=connected');
    const dup = await connect(b);
    expect(decodeURIComponent(dup.headers.get('location')!)).toContain('already connected to another profile');
  });

  it('only lets the owner connect, and viewers cannot sync', async () => {
    const owner = await signUp('strava-owner@example.com', 'Owner');
    const viewer = await signUp('strava-viewer@example.com', 'Viewer');
    await owner.call(`/athletes/${owner.athleteId}/access`, { method: 'POST', body: JSON.stringify({ email: 'strava-viewer@example.com', role: 'viewer' }) });
    expect((await viewer.call(`/athletes/${owner.athleteId}/integrations/strava/connect`, { method: 'POST' })).status).toBe(403);
    expect((await viewer.call(`/athletes/${owner.athleteId}/integrations/strava/sync`, { method: 'POST' })).status).toBe(403);
    expect((await viewer.call(`/athletes/${owner.athleteId}/integrations`)).status).toBe(200);
  });
});
