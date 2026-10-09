import { and, asc, desc, sql as dsql, eq, lte } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import {
  THRESHOLD_METRICS,
  emptyThresholds,
  localIso,
  type AthleteDto,
  type AthleteSummaryDto,
  type SportId,
  type SuggestionDto,
  type ThresholdEntryDto,
  type UpdateProfileInput,
} from '@tc/core';
import { db } from '../db/client';
import { athlete, athleteAccess, athleteExerciseRec, athleteSport, athleteThreshold, suggestion, user } from '../db/schema';
import type { Role } from '../policy';

const COLORS = ['#5C6B24', '#C2562B', '#3F6FB5', '#2F6F73', '#7D5BB0'];

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

type AthleteRow = typeof athlete.$inferSelect;

const toSummary = (a: AthleteRow, role: Role): AthleteSummaryDto => ({
  id: a.id,
  name: a.name,
  firstName: firstNameOf(a.name),
  initials: a.initials,
  color: a.color,
  goal: a.goal,
  role,
});

/** Called on sign-up: the user's own profile with sensible default sports. */
export async function createOwnAthlete(userId: string, name: string) {
  const n = await db.$count(athlete);
  return db.transaction(async (tx) => {
    const [a] = await tx
      .insert(athlete)
      .values({ name, initials: initialsOf(name), color: COLORS[n % COLORS.length]!, createdBy: userId })
      .returning();
    await tx.insert(athleteAccess).values({ userId, athleteId: a!.id, role: 'owner' });
    await tx.insert(athleteSport).values(['run', 'strength', 'mobility'].map((sportId) => ({ athleteId: a!.id, sportId })));
    return a!;
  });
}

export async function listAthletesForUser(userId: string): Promise<AthleteSummaryDto[]> {
  const rows = await db
    .select({ a: athlete, role: athleteAccess.role })
    .from(athleteAccess)
    .innerJoin(athlete, eq(athlete.id, athleteAccess.athleteId))
    .where(eq(athleteAccess.userId, userId))
    .orderBy(asc(athleteAccess.createdAt));
  // Own profile first, then shared ones.
  return rows.map((r) => toSummary(r.a, r.role)).sort((x, y) => Number(y.role === 'owner') - Number(x.role === 'owner'));
}

export async function getAthlete(athleteId: string, role: Role): Promise<AthleteDto> {
  const a = await db.query.athlete.findFirst({ where: eq(athlete.id, athleteId) });
  if (!a) throw new HTTPException(404, { message: 'Athlete not found' });
  const [sports, recs, current] = await Promise.all([
    db.select({ id: athleteSport.sportId }).from(athleteSport).where(eq(athleteSport.athleteId, athleteId)),
    db.select({ id: athleteExerciseRec.exerciseId }).from(athleteExerciseRec).where(eq(athleteExerciseRec.athleteId, athleteId)).orderBy(asc(athleteExerciseRec.position)),
    currentThresholds(athleteId),
  ]);
  return {
    ...toSummary(a, role),
    goalDate: a.goalDate,
    coachNote: a.coachNote,
    recommendationNote: a.recommendationNote,
    recommendedExercises: recs.map((r) => r.id),
    sports: sports.map((s) => s.id as SportId),
    ...current,
  };
}

const sameValue = (a: number | null | undefined, b: number | null) =>
  a === b || (a != null && b !== null && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)));

/** Latest value per metric that is valid today. */
async function currentThresholds(athleteId: string, today = localIso()) {
  const rows = await db
    .selectDistinctOn([athleteThreshold.metric])
    .from(athleteThreshold)
    .where(and(eq(athleteThreshold.athleteId, athleteId), lte(athleteThreshold.validFrom, today)))
    .orderBy(athleteThreshold.metric, desc(athleteThreshold.validFrom));
  const thresholds = emptyThresholds();
  const thresholdsSince: AthleteDto['thresholdsSince'] = {};
  for (const r of rows) {
    thresholds[r.metric] = r.value;
    thresholdsSince[r.metric] = r.validFrom;
  }
  return { thresholds, thresholdsSince };
}

export async function listThresholdHistory(athleteId: string): Promise<ThresholdEntryDto[]> {
  return db
    .select({ metric: athleteThreshold.metric, value: athleteThreshold.value, validFrom: athleteThreshold.validFrom })
    .from(athleteThreshold)
    .where(eq(athleteThreshold.athleteId, athleteId))
    .orderBy(desc(athleteThreshold.validFrom), athleteThreshold.metric);
}

export async function updateProfile(athleteId: string, input: UpdateProfileInput, today = localIso()) {
  const { thresholds: next, ...fields } = input;
  const { thresholds: prev } = await currentThresholds(athleteId, today);
  const changed = THRESHOLD_METRICS.filter((m) => next?.[m] !== undefined && !sameValue(next[m], prev[m]));
  await db.transaction(async (tx) => {
    if (Object.keys(fields).length) {
      await tx
        .update(athlete)
        .set({ ...fields, ...(fields.name ? { initials: initialsOf(fields.name) } : {}) })
        .where(eq(athlete.id, athleteId));
    }
    if (changed.length) {
      // Several edits on the same day overwrite that day's entry instead of growing the history.
      await tx
        .insert(athleteThreshold)
        .values(changed.map((metric) => ({ athleteId, metric, value: next![metric]!, validFrom: today })))
        .onConflictDoUpdate({
          target: [athleteThreshold.athleteId, athleteThreshold.metric, athleteThreshold.validFrom],
          set: { value: dsql`excluded.value` },
        });
    }
  });
}

export async function setSports(athleteId: string, sports: SportId[]) {
  await db.transaction(async (tx) => {
    await tx.delete(athleteSport).where(eq(athleteSport.athleteId, athleteId));
    await tx.insert(athleteSport).values([...new Set(sports)].map((sportId) => ({ athleteId, sportId })));
  });
}

export async function listSuggestions(athleteId: string): Promise<SuggestionDto[]> {
  const rows = await db.select().from(suggestion).where(eq(suggestion.athleteId, athleteId)).orderBy(asc(suggestion.createdAt));
  return rows.map((r) => ({ id: r.id, title: r.title, sport: r.sportId as SportId, durationMin: r.durationMin, why: r.why, exercises: r.exercises }));
}

/** Give another registered user access to an athlete (e.g. your partner as coach). */
export async function shareAthlete(athleteId: string, email: string, role: 'coach' | 'viewer') {
  const [target] = await db.select({ id: user.id }).from(user).where(eq(user.email, email.toLowerCase()));
  if (!target) throw new HTTPException(404, { message: 'No user with that email. They need to sign up first.' });
  await db
    .insert(athleteAccess)
    .values({ userId: target.id, athleteId, role })
    .onConflictDoUpdate({ target: [athleteAccess.userId, athleteAccess.athleteId], set: { role } });
}
