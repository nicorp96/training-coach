// Demo data ported from the design prototype. Replaced by the API (apps/api) in Phase 1.
import {
  addDays,
  startOfWeek,
  weekday,
  type AthleteProfile,
  type DeviceConnection,
  type DeviceProvider,
  type PlannedSession,
  type SessionExercise,
  type SessionSource,
  type SportId,
} from '@tc/core';

export type ProfileId = 'lena' | 'jonas' | 'mia';

export const PROFILES: Record<ProfileId, AthleteProfile> = {
  lena: {
    id: 'lena', name: 'Lena Hoffmann', firstName: 'Lena', initials: 'LH', color: '#5C6B24',
    goal: 'Hamburg Half Marathon', goalDate: '2026-11-22',
    recommendedExercises: ['split', 'rdl', 'calf', 'hipthrust', 'deadbug', 'pallof'],
    recommendationNote: 'Single-leg stability, posterior chain and anti-rotation core: the strength work that carries over to running.',
  },
  jonas: {
    id: 'jonas', name: 'Jonas Weber', firstName: 'Jonas', initials: 'JW', color: '#C2562B',
    goal: 'Squat 120 kg', goalDate: '2026-11-30',
    recommendedExercises: ['squat', 'bench', 'row', 'ohp', 'pullup', 'rdl'],
    recommendationNote: 'Compound lifts for your strength block. Add load weekly and keep one or two reps in reserve.',
  },
  mia: {
    id: 'mia', name: 'Mia Hoffmann', firstName: 'Mia', initials: 'MH', color: '#3F6FB5',
    goal: 'U17 season opener', goalDate: '2026-10-31',
    recommendedExercises: ['lunge', 'pushup', 'plank', 'bridge', 'calf', 'deadbug'],
    recommendationNote: 'Bodyweight basics that support football: balance, core control and injury prevention.',
  },
};
export const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[];

export const DEFAULT_SPORTS: Record<ProfileId, SportId[]> = {
  lena: ['run', 'strength', 'mobility'],
  jonas: ['strength', 'ride', 'run', 'mobility'],
  mia: ['sport', 'strength', 'mobility', 'run'],
};

export const DEVICES: { id: DeviceProvider; name: string; short: string; sub: string }[] = [
  { id: 'garmin', name: 'Garmin Connect', short: 'Garmin', sub: 'Forerunner, fēnix, Edge' },
  { id: 'wahoo', name: 'Wahoo', short: 'Wahoo', sub: 'ELEMNT bike computers, KICKR' },
  { id: 'coros', name: 'COROS', short: 'COROS', sub: 'PACE, APEX, VERTIX' },
];

export const DEFAULT_DEVICES: Record<ProfileId, Partial<Record<DeviceProvider, DeviceConnection>>> = {
  lena: { garmin: { connected: true, importActivities: true, pushWorkouts: true, lastSync: '4 min ago' } },
  jonas: {
    wahoo: { connected: true, importActivities: true, pushWorkouts: true, lastSync: '1 h ago' },
    garmin: { connected: true, importActivities: true, pushWorkouts: false, lastSync: '1 h ago' },
  },
  mia: {},
};

export const COACH_NOTES: Record<ProfileId, string> = {
  lena: 'Saturday’s long run looked strong. I kept today’s load the same and added Pallof presses for core stability.',
  jonas: 'Monday’s squats moved well, so today goes to 5 × 5 at 100 kg. Stop a set early if bar speed drops.',
  mia: 'Match on Saturday, so today stays light. Focus on clean form, not speed.',
};

type Ex = [id: string, sets: number, reps: string, load: string];
type Tpl = [sport: SportId, title: string, time: string, dur: number, ex?: Ex[], note?: string];
const S = (sport: SportId, title: string, time: string, dur: number, ex: Ex[] | 0 = 0, note = ''): Tpl => [sport, title, time, dur, ex || [], note];
const toEx = (ex: Ex[]): SessionExercise[] => ex.map(([id, sets, reps, load]) => ({ id, sets, reps, load }));

/** Weekly template per profile, Monday … Sunday. */
const WEEK_TEMPLATES: Record<ProfileId, Tpl[][]> = {
  lena: [
    [S('strength', 'Runner strength A', '07:00', 45, [['split', 3, '8 / leg', '2×12 kg'], ['rdl', 3, '8', '50 kg'], ['calf', 3, '12 / leg', 'BW'], ['deadbug', 3, '10', 'BW']])],
    [S('run', 'Easy run · 8 km', '07:00', 50, 0, 'Conversational pace, heart rate under 145.')],
    [S('strength', 'Lower body strength', '07:00', 55, [['split', 4, '8 / leg', '2×14 kg'], ['hipthrust', 4, '10', '70 kg'], ['rdl', 3, '8', '55 kg'], ['calf', 3, '15 / leg', 'BW'], ['pallof', 3, '12 / side', 'Band']]), S('run', 'Recovery jog · 5 km', '18:30', 30, 0, 'Very easy. Shake out the legs from this morning.')],
    [S('mobility', 'Mobility flow', '19:00', 30, 0, 'Hips, ankles and thoracic spine. 30 minutes, no rush.')],
    [S('run', 'Intervals · 6×800 m', '07:00', 60, 0, '2 km warm-up, 6×800 m at 10K pace with 90 s jog, 2 km cool-down.')],
    [S('run', 'Long run · 18 km', '09:00', 105, 0, 'Steady. Last 3 km at half-marathon pace.')],
    [],
  ],
  jonas: [
    [S('strength', 'Push day', '18:00', 60, [['bench', 4, '6', '80 kg'], ['ohp', 3, '8', '45 kg'], ['pushup', 3, 'AMRAP', 'BW'], ['lateral', 3, '12', '2×8 kg']])],
    [S('strength', 'Pull day', '18:00', 55, [['pullup', 4, '6', 'BW'], ['row', 4, '8', '60 kg'], ['curl', 3, '10', '2×12 kg'], ['plank', 3, '45 s', 'BW']])],
    [S('ride', 'Zone 2 bike', '07:30', 40, 0, 'Easy spin, nasal breathing.'), S('strength', 'Leg day', '18:00', 65, [['squat', 5, '5', '100 kg'], ['rdl', 3, '8', '80 kg'], ['lunge', 3, '10 / leg', '2×16 kg'], ['plank', 3, '45 s', 'BW']])],
    [S('mobility', 'Hips & shoulders', '19:00', 25, 0, 'Couch stretch, 90/90, band dislocates.')],
    [S('strength', 'Full body', '18:00', 60, [['squat', 3, '8', '85 kg'], ['bench', 3, '8', '70 kg'], ['row', 3, '10', '55 kg'], ['pallof', 3, '12 / side', 'Band']])],
    [S('run', 'Run · 6 km', '10:00', 35, 0, 'Easy pace.')],
    [S('ride', 'Road bike · 60 km', '09:30', 120, 0, 'Endurance ride at 180–200 W. Eat every 30 minutes.')],
  ],
  mia: [
    [S('sport', 'Football practice', '17:30', 90, 0, 'Team session.')],
    [S('strength', 'Strength basics', '16:00', 35, [['lunge', 3, '8 / leg', 'BW'], ['pushup', 3, '8', 'BW'], ['plank', 3, '30 s', 'BW'], ['deadbug', 3, '8', 'BW']])],
    [S('strength', 'Strength basics B', '16:00', 30, [['bridge', 3, '10 / leg', 'BW'], ['calf', 3, '12 / leg', 'BW'], ['pushup', 3, '8', 'BW'], ['plank', 3, '30 s', 'BW']]), S('sport', 'Football practice', '18:00', 90, 0, 'Team session.')],
    [S('mobility', 'Stretch & roll', '19:30', 20, 0, 'Foam roller and hamstring stretches.')],
    [S('sport', 'Football practice', '17:30', 90, 0, 'Team session.')],
    [S('sport', 'Match day', '11:00', 90, 0, 'Home game. Arrive 45 minutes early.')],
    [],
  ],
};

const WEEK_SOURCES: Record<ProfileId, SessionSource[][]> = {
  lena: [['coach'], ['me'], ['coach', 'me'], ['past'], ['coach'], ['coach'], []],
  jonas: [['past'], ['past'], ['me', 'coach'], ['coach'], ['coach'], ['me'], ['me']],
  mia: [['me'], ['coach'], ['coach', 'me'], ['past'], ['me'], ['me'], []],
};

/** Expand the weekly template into sessions around `today`. Deterministic, so it is not persisted. */
export function generateSessions(pid: ProfileId, today: string): PlannedSession[] {
  const out: PlannedSession[] = [];
  const end = addDays(startOfWeek(today), 7 * 10);
  for (let d = addDays(startOfWeek(today), -7 * 6); d < end; d = addDays(d, 1)) {
    const wd = weekday(d);
    WEEK_TEMPLATES[pid][wd]!.forEach(([sport, title, time, dur, ex, note], i) =>
      out.push({
        id: `${pid}-${d}-${i}`,
        date: d,
        sport,
        title,
        time,
        durationMin: dur,
        exercises: toEx(ex ?? []),
        note: note ?? '',
        source: WEEK_SOURCES[pid][wd]![i] ?? 'coach',
        repeatedFrom: addDays(d, -7),
      }),
    );
  }
  return out;
}

export type CoachSuggestion = {
  title: string;
  sport: SportId;
  durationMin: number;
  why: string;
  exercises: SessionExercise[];
};

const CS = (title: string, sport: SportId, durationMin: number, why: string, ex: Ex[] = []): CoachSuggestion => ({ title, sport, durationMin, why, exercises: toEx(ex) });

export const COACH_SUGGESTIONS: Record<ProfileId, CoachSuggestion[]> = {
  lena: [
    CS('Runner strength B', 'strength', 45, 'Thursday is free and your legs recover well by then. Short and single-leg focused.', [['bridge', 3, '12 / leg', 'BW'], ['calf', 3, '15 / leg', 'BW'], ['deadbug', 3, '10', 'BW'], ['pallof', 3, '12 / side', 'Band']]),
    CS('Tempo run · 6 km', 'run', 40, 'One quality session before the long run: 4 km at half-marathon pace in the middle.'),
    CS('Hip mobility', 'mobility', 20, 'Your hip-thrust load went up 10 kg in two weeks. Keep the hips moving.'),
  ],
  jonas: [
    CS('Squat technique', 'strength', 40, 'Bar speed dropped on your last two sets at 100 kg. Lighter paused reps rebuild speed.', [['squat', 5, '3 paused', '80 kg'], ['split', 3, '8 / leg', '2×14 kg'], ['plank', 3, '45 s', 'BW']]),
    CS('Upper back volume', 'strength', 45, 'Pulling volume is behind pushing in this block.', [['row', 4, '10', '55 kg'], ['pullup', 3, '8', 'BW'], ['lateral', 3, '15', '2×6 kg']]),
    CS('Zone 2 bike', 'ride', 40, 'Easy aerobic work helps recovery between leg days.'),
  ],
  mia: [
    CS('Pre-match activation', 'strength', 20, 'Light and short the day before a match.', [['bridge', 2, '10 / leg', 'BW'], ['lunge', 2, '6 / leg', 'BW'], ['plank', 2, '20 s', 'BW']]),
    CS('Balance & ankles', 'strength', 25, 'Regular balance work means fewer ankle sprains during the season.', [['calf', 3, '12 / leg', 'BW'], ['lunge', 3, '8 / leg', 'BW'], ['deadbug', 3, '8', 'BW']]),
    CS('Stretch & roll', 'mobility', 20, 'Recovery after two practices in a row.'),
  ],
};
