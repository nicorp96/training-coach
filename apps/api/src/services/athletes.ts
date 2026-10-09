import { asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import type { AthleteDto, AthleteSummaryDto, SportId, SuggestionDto } from '@tc/core';
import { db } from '../db/client';
import { athlete, athleteAccess, athleteExerciseRec, athleteSport, suggestion, user } from '../db/schema';
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
  const [sports, recs] = await Promise.all([
    db.select({ id: athleteSport.sportId }).from(athleteSport).where(eq(athleteSport.athleteId, athleteId)),
    db.select({ id: athleteExerciseRec.exerciseId }).from(athleteExerciseRec).where(eq(athleteExerciseRec.athleteId, athleteId)).orderBy(asc(athleteExerciseRec.position)),
  ]);
  return {
    ...toSummary(a, role),
    goalDate: a.goalDate,
    coachNote: a.coachNote,
    recommendationNote: a.recommendationNote,
    recommendedExercises: recs.map((r) => r.id),
    sports: sports.map((s) => s.id as SportId),
  };
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
