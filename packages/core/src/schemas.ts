// API contract shared by apps/api (validation) and clients (types, form validation).
import { z } from 'zod';
import { SPORT_IDS, type SportId } from './sports';
import { THRESHOLD_INFO, THRESHOLD_METRICS, type ThresholdMetric, type Thresholds } from './thresholds';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

export const sportId = z.enum(SPORT_IDS as [SportId, ...SportId[]]);
export const sessionSource = z.enum(['coach', 'me', 'past']);
export const accessRole = z.enum(['owner', 'coach', 'viewer']);
export const deviceProvider = z.enum(['garmin', 'wahoo', 'coros']);

export const sessionExerciseInput = z.object({
  exerciseId: z.string().min(1).max(64),
  sets: z.int().min(1).max(20),
  reps: z.string().trim().min(1).max(24),
  load: z.string().trim().max(24),
});

export const createSessionInput = z.object({
  date: isoDate,
  time: hhmm,
  durationMin: z.int().min(1).max(24 * 60),
  sport: sportId,
  title: z.string().trim().min(1).max(120),
  note: z.string().trim().max(2000).default(''),
  source: sessionSource.default('me'),
  repeatedFrom: isoDate.nullish(),
  distanceKm: z.number().positive().max(1000).nullish(),
  target: z.string().trim().max(60).nullish(),
  exercises: z.array(sessionExerciseInput).max(40).default([]),
});
export type CreateSessionInput = z.input<typeof createSessionInput>;

export const updateSessionInput = z
  .object({
    date: isoDate,
    time: hhmm,
    durationMin: z.int().min(1).max(24 * 60),
    title: z.string().trim().min(1).max(120),
    note: z.string().trim().max(2000),
    completed: z.boolean(),
    rpe: z.int().min(1).max(10).nullable(),
    feeling: z.int().min(1).max(5).nullable(),
  })
  .partial();
export type UpdateSessionInput = z.infer<typeof updateSessionInput>;

export const updateSessionExerciseInput = z.object({ done: z.boolean() });

export const sessionsQuery = z.object({ from: isoDate, to: isoDate });

export const setSportsInput = z.object({ sports: z.array(sportId).min(1) });

export const updateDeviceInput = z
  .object({ connected: z.boolean(), importActivities: z.boolean(), pushWorkouts: z.boolean() })
  .partial();

export const thresholdMetric = z.enum(THRESHOLD_METRICS);

const thresholdValues = z.object(
  Object.fromEntries(
    THRESHOLD_METRICS.map((m) => [m, z.number().min(THRESHOLD_INFO[m].min).max(THRESHOLD_INFO[m].max).nullable().optional()]),
  ) as Record<ThresholdMetric, z.ZodOptional<z.ZodNullable<z.ZodNumber>>>,
);

export const updateProfileInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  goal: z.string().trim().max(120).nullable().optional(),
  goalDate: isoDate.nullable().optional(),
  /** SI units; null clears a value. Changed values start a new history entry valid from today. */
  thresholds: thresholdValues.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileInput>;

export const shareAccessInput = z.object({ email: z.email(), role: z.enum(['coach', 'viewer']) });

// ---- Response DTOs ----

export type SessionExerciseDto = {
  rowId: string;
  /** Exercise id from the catalog. */
  id: string;
  sets: number;
  reps: string;
  load: string;
  done: boolean;
};

export type SessionDto = {
  id: string;
  athleteId: string;
  date: string;
  time: string;
  durationMin: number;
  sport: SportId;
  title: string;
  note: string;
  source: z.infer<typeof sessionSource>;
  repeatedFrom: string | null;
  completedAt: string | null;
  rpe: number | null;
  feeling: number | null;
  exercises: SessionExerciseDto[];
};

export type AthleteSummaryDto = {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  color: string;
  goal: string | null;
  role: z.infer<typeof accessRole>;
};

export type AthleteDto = AthleteSummaryDto & {
  goalDate: string | null;
  coachNote: string | null;
  recommendationNote: string | null;
  recommendedExercises: string[];
  sports: SportId[];
  thresholds: Thresholds;
  /** Date each current threshold has been valid from. */
  thresholdsSince: Partial<Record<ThresholdMetric, string>>;
};

export type ThresholdEntryDto = { metric: ThresholdMetric; value: number | null; validFrom: string };

export type MeDto = {
  user: { id: string; name: string; email: string };
  athletes: AthleteSummaryDto[];
};

export type SuggestionDto = {
  id: string;
  title: string;
  sport: SportId;
  durationMin: number;
  why: string;
  exercises: { id: string; sets: number; reps: string; load: string }[];
};

export type DeviceDto = {
  provider: z.infer<typeof deviceProvider>;
  connected: boolean;
  importActivities: boolean;
  pushWorkouts: boolean;
  lastSyncAt: string | null;
};
