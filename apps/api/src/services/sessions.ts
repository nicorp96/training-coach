import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import type { ActivityDto, CreateSessionInput, SessionDto, SportId, UpdateSessionInput } from '@tc/core';
import { createSessionInput } from '@tc/core';
import { db } from '../db/client';
import { activity, exercise, plannedSession, sessionExercise } from '../db/schema';

type ActivityRow = typeof activity.$inferSelect;
type SessionRow = typeof plannedSession.$inferSelect & { exercises: (typeof sessionExercise.$inferSelect)[]; activities: ActivityRow[] };

const activityDto = (a: ActivityRow): ActivityDto => ({
  id: a.id,
  provider: a.provider,
  externalUrl: `https://www.strava.com/activities/${a.externalId}`,
  name: a.name,
  movingSec: a.movingSec,
  distanceM: a.distanceM,
  elevationGainM: a.elevationGainM,
  avgHr: a.avgHr,
  maxHr: a.maxHr,
  avgWatts: a.avgWatts,
  normalizedWatts: a.normalizedWatts,
  avgSpeed: a.avgSpeed,
});

const toDto = (s: SessionRow): SessionDto => ({
  id: s.id,
  athleteId: s.athleteId,
  date: s.date,
  time: s.time.slice(0, 5),
  durationMin: s.durationMin,
  sport: s.sportId as SportId,
  title: s.title,
  note: s.note,
  source: s.source,
  repeatedFrom: s.repeatedFrom,
  completedAt: s.completedAt?.toISOString() ?? null,
  rpe: s.rpe,
  feeling: s.feeling,
  exercises: [...s.exercises]
    .sort((a, b) => a.position - b.position)
    .map((e) => ({ rowId: e.id, id: e.exerciseId, sets: e.sets, reps: e.reps, load: e.load, done: !!e.doneAt })),
  activity: s.activities[0] ? activityDto(s.activities[0]) : null,
});

const withExercises = { exercises: true, activities: true } as const;

export async function listSessions(athleteId: string, from: string, to: string): Promise<SessionDto[]> {
  const rows = await db.query.plannedSession.findMany({
    where: and(eq(plannedSession.athleteId, athleteId), gte(plannedSession.date, from), lte(plannedSession.date, to)),
    orderBy: [asc(plannedSession.date), asc(plannedSession.time)],
    with: withExercises,
  });
  return rows.map(toDto);
}

export async function getSession(sessionId: string): Promise<SessionDto | null> {
  const row = await db.query.plannedSession.findFirst({ where: eq(plannedSession.id, sessionId), with: withExercises });
  return row ? toDto(row) : null;
}

/** Owner athlete of a session, for authorization. */
export async function sessionAthleteId(sessionId: string): Promise<string | null> {
  const [row] = await db.select({ athleteId: plannedSession.athleteId }).from(plannedSession).where(eq(plannedSession.id, sessionId));
  return row?.athleteId ?? null;
}

export async function createSession(athleteId: string, userId: string, raw: CreateSessionInput): Promise<SessionDto> {
  const input = createSessionInput.parse(raw);
  const ids = [...new Set(input.exercises.map((e) => e.exerciseId))];
  if (ids.length) {
    const known = await db.select({ id: exercise.id }).from(exercise).where(inArray(exercise.id, ids));
    const missing = ids.filter((id) => !known.some((k) => k.id === id));
    if (missing.length) throw new HTTPException(400, { message: `Unknown exercises: ${missing.join(', ')}` });
  }
  const id = await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(plannedSession)
      .values({
        athleteId,
        date: input.date,
        time: input.time,
        durationMin: input.durationMin,
        sportId: input.sport,
        title: input.title,
        note: input.note,
        source: input.source,
        repeatedFrom: input.repeatedFrom ?? null,
        distanceM: input.distanceKm != null ? input.distanceKm * 1000 : null,
        target: input.target ?? null,
        createdBy: userId,
      })
      .returning({ id: plannedSession.id });
    if (input.exercises.length) {
      await tx.insert(sessionExercise).values(
        input.exercises.map((e, position) => ({ sessionId: s!.id, position, exerciseId: e.exerciseId, sets: e.sets, reps: e.reps, load: e.load })),
      );
    }
    return s!.id;
  });
  return (await getSession(id))!;
}

export async function updateSession(sessionId: string, input: UpdateSessionInput): Promise<SessionDto> {
  const { completed, ...fields } = input;
  await db.transaction(async (tx) => {
    const patch: Partial<typeof plannedSession.$inferInsert> = { ...fields };
    if (completed !== undefined) patch.completedAt = completed ? new Date() : null;
    if (Object.keys(patch).length) await tx.update(plannedSession).set(patch).where(eq(plannedSession.id, sessionId));
    // Un-completing a session also clears its ticked exercises, mirroring the UI.
    if (completed === false) await tx.update(sessionExercise).set({ doneAt: null }).where(eq(sessionExercise.sessionId, sessionId));
  });
  return (await getSession(sessionId))!;
}

export async function deleteSession(sessionId: string) {
  await db.delete(plannedSession).where(eq(plannedSession.id, sessionId));
}

export async function setExerciseDone(sessionId: string, rowId: string, done: boolean): Promise<SessionDto> {
  const res = await db
    .update(sessionExercise)
    .set({ doneAt: done ? new Date() : null })
    .where(and(eq(sessionExercise.id, rowId), eq(sessionExercise.sessionId, sessionId)))
    .returning({ id: sessionExercise.id });
  if (!res.length) throw new HTTPException(404, { message: 'Exercise not found in session' });
  return (await getSession(sessionId))!;
}
