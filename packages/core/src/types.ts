import type { Prescription } from './exercises';

/** Who put a session in the calendar. `import` = an unplanned activity imported from Strava etc. */
export type SessionSource = 'coach' | 'me' | 'past' | 'import';
/** Sources a person can choose when planning. */
export type PlannedSource = Exclude<SessionSource, 'import'>;

export type SessionExercise = Prescription & { id: string };

export type DeviceProvider = 'garmin' | 'wahoo' | 'coros';
