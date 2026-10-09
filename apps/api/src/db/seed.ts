import { eq, sql as dsql } from 'drizzle-orm';
import { EXERCISES, SPORTS, localIso } from '@tc/core';
import { db, sql } from './client';
import { athlete, athleteAccess, athleteExerciseRec, athleteSport, deviceConnection, exercise, sport, suggestion, user } from './schema';
import { COACH_NOTES, COACH_SUGGESTIONS, DEFAULT_DEVICES, DEFAULT_SPORTS, PROFILES, PROFILE_IDS, generateSessions } from './demo-data';

/** Upserts the global sport and exercise catalog from @tc/core. Safe to run on every start. */
export async function seedCatalog() {
  await db
    .insert(sport)
    .values(Object.values(SPORTS).map((s) => ({ id: s.id, label: s.label, color: s.color, description: s.description, endurance: s.endurance })))
    .onConflictDoUpdate({
      target: sport.id,
      set: { label: dsql`excluded.label`, color: dsql`excluded.color`, description: dsql`excluded.description`, endurance: dsql`excluded.endurance` },
    });
  await db
    .insert(exercise)
    .values(Object.values(EXERCISES).map((e) => ({
      id: e.id, name: e.name, group: e.group, equipment: e.equipment, level: e.level, muscles: e.muscles, cue: e.cue,
      defaultSets: e.defaults.sets, defaultReps: e.defaults.reps, defaultLoad: e.defaults.load,
    })))
    .onConflictDoUpdate({
      target: exercise.id,
      set: {
        name: dsql`excluded.name`, group: dsql`excluded.muscle_group`, equipment: dsql`excluded.equipment`, level: dsql`excluded.level`,
        muscles: dsql`excluded.muscles`, cue: dsql`excluded.cue`, defaultSets: dsql`excluded.default_sets`,
        defaultReps: dsql`excluded.default_reps`, defaultLoad: dsql`excluded.default_load`,
      },
    });
}

export const DEMO_EMAIL = 'demo@tempo.local';
export const DEMO_PASSWORD = 'tempo-demo-1234';

/**
 * Local-only demo: a demo user who coaches Lena, Jonas and Mia, with sessions around today.
 * Creates the user through Better Auth so the password is hashed correctly.
 */
export async function seedDemo() {
  const { auth } = await import('../auth');
  const { createSession } = await import('../services/sessions');
  const { initialsOf } = await import('../services/athletes');

  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, DEMO_EMAIL));
  if (existing.length) {
    console.log('Demo user already exists, skipping');
    return;
  }
  const res = await auth.api.signUpEmail({ body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: 'Demo Coach' } });
  const userId = res.user.id;
  // Replace the auto-created own profile with the three demo athletes.
  const own = await db.select({ id: athleteAccess.athleteId }).from(athleteAccess).where(eq(athleteAccess.userId, userId));
  for (const o of own) await db.delete(athlete).where(eq(athlete.id, o.id));

  const today = localIso();
  for (const pid of PROFILE_IDS) {
    const P = PROFILES[pid];
    const [a] = await db.insert(athlete).values({
      name: P.name, initials: initialsOf(P.name), color: P.color, goal: P.goal, goalDate: P.goalDate,
      coachNote: COACH_NOTES[pid], recommendationNote: P.recommendationNote, createdBy: userId,
    }).returning();
    const aid = a!.id;
    await db.insert(athleteAccess).values({ userId, athleteId: aid, role: pid === 'lena' ? 'owner' : 'coach' });
    await db.insert(athleteSport).values(DEFAULT_SPORTS[pid].map((sportId) => ({ athleteId: aid, sportId })));
    await db.insert(athleteExerciseRec).values(P.recommendedExercises.map((exerciseId, position) => ({ athleteId: aid, exerciseId, position })));
    await db.insert(suggestion).values(COACH_SUGGESTIONS[pid].map((s) => ({ athleteId: aid, title: s.title, sportId: s.sport, durationMin: s.durationMin, why: s.why, exercises: s.exercises })));
    const devices = Object.entries(DEFAULT_DEVICES[pid]);
    if (devices.length) {
      await db.insert(deviceConnection).values(devices.map(([provider, d]) => ({
        athleteId: aid, provider: provider as 'garmin' | 'wahoo' | 'coros', connected: d.connected,
        importActivities: d.importActivities, pushWorkouts: d.pushWorkouts, lastSyncAt: new Date(Date.now() - d.lastSyncMinAgo * 60_000),
      })));
    }
    for (const s of generateSessions(pid, today)) await createSession(aid, userId, s);
    // Past sessions count as completed, like in the prototype.
    await db.execute(dsql`update planned_session set completed_at = (date + time)::timestamptz where athlete_id = ${aid} and date < ${today}`);
    await db.execute(dsql`update session_exercise se set done_at = ps.completed_at from planned_session ps where se.session_id = ps.id and ps.athlete_id = ${aid} and ps.date < ${today}`);
  }
  console.log(`Demo data created. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runMigrations } = await import('./migrate');
  await runMigrations();
  await seedCatalog();
  console.log('Catalog seeded');
  if (process.argv.includes('--demo')) await seedDemo();
  await sql.end();
}
