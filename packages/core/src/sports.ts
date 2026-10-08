// Sports are data, not code branches. Add a sport here (and later in the DB seed)
// instead of writing `if (sport === 'run')` anywhere in the apps.

export type SportId = 'run' | 'ride' | 'strength' | 'mobility' | 'sport';

export type Sport = {
  id: SportId;
  label: string;
  color: string;
  description: string;
  /** Endurance sports get distance and pace/power targets. */
  endurance: boolean;
  /** Placeholder shown for the target field in the training builder. */
  targetHint?: string;
};

export const SPORTS: Record<SportId, Sport> = {
  run: { id: 'run', label: 'Running', color: '#C2562B', description: 'Easy, tempo, intervals, long', endurance: true, targetHint: 'e.g. 5:30 /km' },
  ride: { id: 'ride', label: 'Road bike', color: '#2F6F73', description: 'Endurance, sweet spot, climbs', endurance: true, targetHint: 'e.g. 180–200 W' },
  strength: { id: 'strength', label: 'Strength', color: '#5C6B24', description: 'Gym and bodyweight', endurance: false },
  mobility: { id: 'mobility', label: 'Mobility', color: '#3F6FB5', description: 'Stretching and recovery', endurance: false },
  sport: { id: 'sport', label: 'Team sport', color: '#7D5BB0', description: 'Practice or match', endurance: false },
};

export const SPORT_IDS = Object.keys(SPORTS) as SportId[];

/** Light background tint for a sport color. */
export const tint = (color: string) => `color-mix(in oklch, ${color} 13%, #FFFFFF)`;
