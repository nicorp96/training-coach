import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Better Auth tables (model names must match Better Auth's: user, session, account, verification)
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  ...timestamps,
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  ...timestamps,
}, (t) => [index('session_user_idx').on(t.userId)]);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  ...timestamps,
}, (t) => [index('account_user_idx').on(t.userId)]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps,
}, (t) => [index('verification_identifier_idx').on(t.identifier)]);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const sport = pgTable('sport', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  description: text('description').notNull(),
  endurance: boolean('endurance').notNull().default(false),
});

export const exercise = pgTable('exercise', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  group: text('muscle_group').notNull(),
  equipment: text('equipment').notNull(),
  level: text('level').notNull(),
  muscles: text('muscles').notNull(),
  cue: text('cue').notNull(),
  defaultSets: integer('default_sets').notNull(),
  defaultReps: text('default_reps').notNull(),
  defaultLoad: text('default_load').notNull(),
  /** NULL = global catalog exercise; otherwise a user's custom exercise. */
  ownerId: text('owner_id').references(() => user.id, { onDelete: 'cascade' }),
});

// ---------------------------------------------------------------------------
// Athletes & access
// ---------------------------------------------------------------------------

export const accessRole = pgEnum('access_role', ['owner', 'coach', 'viewer']);

export const athlete = pgTable('athlete', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  initials: text('initials').notNull(),
  color: text('color').notNull().default('#5C6B24'),
  goal: text('goal'),
  goalDate: date('goal_date'),
  coachNote: text('coach_note'),
  recommendationNote: text('recommendation_note'),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
});

export const athleteAccess = pgTable('athlete_access', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  athleteId: uuid('athlete_id').notNull().references(() => athlete.id, { onDelete: 'cascade' }),
  role: accessRole('role').notNull(),
  createdAt: timestamps.createdAt,
}, (t) => [primaryKey({ columns: [t.userId, t.athleteId] })]);

export const athleteSport = pgTable('athlete_sport', {
  athleteId: uuid('athlete_id').notNull().references(() => athlete.id, { onDelete: 'cascade' }),
  sportId: text('sport_id').notNull().references(() => sport.id),
}, (t) => [primaryKey({ columns: [t.athleteId, t.sportId] })]);

export const athleteExerciseRec = pgTable('athlete_exercise_rec', {
  athleteId: uuid('athlete_id').notNull().references(() => athlete.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull().references(() => exercise.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
}, (t) => [primaryKey({ columns: [t.athleteId, t.exerciseId] })]);

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export const sessionSource = pgEnum('session_source', ['coach', 'me', 'past']);

export const plannedSession = pgTable('planned_session', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id').notNull().references(() => athlete.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  time: time('time').notNull(),
  durationMin: integer('duration_min').notNull(),
  sportId: text('sport_id').notNull().references(() => sport.id),
  title: text('title').notNull(),
  note: text('note').notNull().default(''),
  source: sessionSource('source').notNull().default('me'),
  repeatedFrom: date('repeated_from'),
  distanceM: real('distance_m'),
  target: text('target'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  rpe: integer('rpe'),
  feeling: integer('feeling'),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
}, (t) => [index('planned_session_athlete_date_idx').on(t.athleteId, t.date)]);

export const sessionExercise = pgTable('session_exercise', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => plannedSession.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  exerciseId: text('exercise_id').notNull().references(() => exercise.id),
  sets: integer('sets').notNull(),
  reps: text('reps').notNull(),
  load: text('load').notNull().default(''),
  doneAt: timestamp('done_at', { withTimezone: true }),
}, (t) => [uniqueIndex('session_exercise_position_idx').on(t.sessionId, t.position)]);

export const suggestion = pgTable('suggestion', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id').notNull().references(() => athlete.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sportId: text('sport_id').notNull().references(() => sport.id),
  durationMin: integer('duration_min').notNull(),
  why: text('why').notNull(),
  exercises: jsonb('exercises').$type<{ id: string; sets: number; reps: string; load: string }[]>().notNull().default(sql`'[]'::jsonb`),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export const deviceProvider = pgEnum('device_provider', ['garmin', 'wahoo', 'coros']);

export const deviceConnection = pgTable('device_connection', {
  athleteId: uuid('athlete_id').notNull().references(() => athlete.id, { onDelete: 'cascade' }),
  provider: deviceProvider('provider').notNull(),
  connected: boolean('connected').notNull().default(false),
  importActivities: boolean('import_activities').notNull().default(true),
  pushWorkouts: boolean('push_workouts').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [primaryKey({ columns: [t.athleteId, t.provider] })]);

// ---------------------------------------------------------------------------
// Relations (for db.query)
// ---------------------------------------------------------------------------

export const plannedSessionRelations = relations(plannedSession, ({ many }) => ({
  exercises: many(sessionExercise),
}));
export const sessionExerciseRelations = relations(sessionExercise, ({ one }) => ({
  session: one(plannedSession, { fields: [sessionExercise.sessionId], references: [plannedSession.id] }),
}));
