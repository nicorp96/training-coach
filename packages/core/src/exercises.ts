export const MUSCLE_GROUPS = ['Legs', 'Glutes', 'Back', 'Chest', 'Shoulders', 'Core', 'Arms'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export type Level = 'Beginner' | 'Intermediate' | 'Advanced';

export type Prescription = { sets: number; reps: string; load: string };

export type Exercise = {
  id: string;
  name: string;
  group: MuscleGroup;
  equipment: string;
  level: Level;
  muscles: string;
  cue: string;
  /** Default prescription when the exercise is added to a session. */
  defaults: Prescription;
};

const X = (
  id: string,
  name: string,
  group: MuscleGroup,
  equipment: string,
  level: Level,
  muscles: string,
  cue: string,
  [sets, reps, load]: [number, string, string],
): Exercise => ({ id, name, group, equipment, level, muscles, cue, defaults: { sets, reps, load } });

const LIST: Exercise[] = [
  X('squat', 'Back squat', 'Legs', 'Barbell', 'Intermediate', 'Quads, glutes, adductors', 'Brace before you descend. Knees track over toes, hips sit between the heels.', [4, '6', '80 kg']),
  X('rdl', 'Romanian deadlift', 'Legs', 'Barbell', 'Intermediate', 'Hamstrings, glutes', 'Soft knees, push the hips back until you feel the hamstrings. Bar stays close.', [3, '8', '60 kg']),
  X('split', 'Bulgarian split squat', 'Legs', 'Dumbbells', 'Intermediate', 'Quads, glutes', 'Rear foot on a bench. Lower the back knee straight down, front heel planted.', [3, '8 / leg', '2×12 kg']),
  X('lunge', 'Walking lunge', 'Legs', 'Dumbbells', 'Beginner', 'Quads, glutes', 'Long step, back knee almost touches the floor. Torso stays tall.', [3, '10 / leg', '2×10 kg']),
  X('calf', 'Single-leg calf raise', 'Legs', 'Bodyweight', 'Beginner', 'Calves, Achilles', 'Full range: pause at the top, lower for three seconds.', [3, '12 / leg', 'BW']),
  X('hipthrust', 'Hip thrust', 'Glutes', 'Barbell', 'Intermediate', 'Glutes, hamstrings', 'Shoulders on the bench, chin tucked. Drive through the heels and lock out.', [4, '10', '60 kg']),
  X('bridge', 'Single-leg glute bridge', 'Glutes', 'Bodyweight', 'Beginner', 'Glutes', 'Keep the hips level as you press up. Squeeze for two seconds.', [3, '12 / leg', 'BW']),
  X('pullup', 'Pull-up', 'Back', 'Pull-up bar', 'Advanced', 'Lats, biceps', 'Start from a dead hang. Pull the chest to the bar, control the way down.', [4, '6', 'BW']),
  X('row', 'Bent-over row', 'Back', 'Barbell', 'Intermediate', 'Upper back, lats', 'Hinge to 45°, flat back. Pull the bar to the lower ribs.', [4, '8', '50 kg']),
  X('bench', 'Bench press', 'Chest', 'Barbell', 'Intermediate', 'Chest, triceps, front delts', 'Shoulder blades pinned, feet planted. Touch mid-chest, press up and back.', [4, '6', '70 kg']),
  X('pushup', 'Push-up', 'Chest', 'Bodyweight', 'Beginner', 'Chest, triceps, core', 'Body in one line. Elbows at roughly 45° to the torso.', [3, '12', 'BW']),
  X('ohp', 'Overhead press', 'Shoulders', 'Barbell', 'Intermediate', 'Shoulders, triceps', 'Squeeze the glutes, press straight up and move the head through at the top.', [3, '8', '40 kg']),
  X('lateral', 'Lateral raise', 'Shoulders', 'Dumbbells', 'Beginner', 'Side delts', 'Lead with the elbows, stop at shoulder height. Slow on the way down.', [3, '12', '2×8 kg']),
  X('plank', 'Plank', 'Core', 'Bodyweight', 'Beginner', 'Deep core, shoulders', 'Elbows under shoulders, ribs down, glutes tight.', [3, '45 s', 'BW']),
  X('deadbug', 'Dead bug', 'Core', 'Bodyweight', 'Beginner', 'Deep core', 'Lower back pressed into the floor while the opposite arm and leg extend.', [3, '10', 'BW']),
  X('pallof', 'Pallof press', 'Core', 'Band', 'Beginner', 'Obliques, anti-rotation', 'Press the band straight out and resist the pull. Hips stay square.', [3, '12 / side', 'Band']),
  X('curl', 'Biceps curl', 'Arms', 'Dumbbells', 'Beginner', 'Biceps', 'Elbows fixed at your sides, no swinging.', [3, '10', '2×12 kg']),
];

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(LIST.map((e) => [e.id, e]));
export const EXERCISE_IDS = LIST.map((e) => e.id);

export const getExercise = (id: string): Exercise => {
  const e = EXERCISES[id];
  if (!e) throw new Error(`Unknown exercise: ${id}`);
  return e;
};
