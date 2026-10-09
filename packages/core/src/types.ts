import type { Prescription } from './exercises';

/** Who put a session in the calendar. */
export type SessionSource = 'coach' | 'me' | 'past';

export type SessionExercise = Prescription & { id: string };

export type DeviceProvider = 'garmin' | 'wahoo' | 'coros';
