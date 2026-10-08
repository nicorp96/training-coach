import type { Prescription } from './exercises';
import type { SportId } from './sports';

/** Who put a session in the calendar. */
export type SessionSource = 'coach' | 'me' | 'past';

export type SessionExercise = Prescription & { id: string };

export type PlannedSession = {
  id: string;
  date: string; // ISO date
  time: string; // HH:mm
  durationMin: number;
  sport: SportId;
  title: string;
  note: string;
  exercises: SessionExercise[];
  source: SessionSource;
  /** For repeated sessions: the date of the original. */
  repeatedFrom?: string | null;
};

export type DeviceProvider = 'garmin' | 'wahoo' | 'coros';

export type DeviceConnection = {
  connected: boolean;
  importActivities: boolean;
  pushWorkouts: boolean;
  lastSync?: string;
};

export type AthleteProfile = {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  color: string;
  goal: string;
  goalDate: string;
  recommendedExercises: string[];
  recommendationNote: string;
};
