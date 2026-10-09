// Athlete thresholds (performance markers). Stored in SI units; pace is derived from speed.

export const THRESHOLD_METRICS = ['ftp', 'thresholdSpeed', 'lthr', 'maxHr', 'restingHr', 'weight'] as const;
export type ThresholdMetric = (typeof THRESHOLD_METRICS)[number];

/** Current value per metric in SI units (W, m/s, bpm, kg); null = not set. */
export type Thresholds = Record<ThresholdMetric, number | null>;

export const THRESHOLD_INFO: Record<ThresholdMetric, { label: string; unit: string; min: number; max: number; hint: string }> = {
  ftp: { label: 'FTP', unit: 'W', min: 50, max: 600, hint: 'Best 1-hour power, or 95% of a 20-min test' },
  // 15:00 /km … 2:00 /km
  thresholdSpeed: { label: 'Threshold pace', unit: '/km', min: 1000 / 900, max: 1000 / 120, hint: 'Pace you could hold for about an hour (10k race pace + 5–10 s)' },
  lthr: { label: 'Threshold heart rate', unit: 'bpm', min: 100, max: 220, hint: 'Avg HR of the last 20 min of a 30-min all-out run' },
  maxHr: { label: 'Max heart rate', unit: 'bpm', min: 120, max: 230, hint: 'Highest HR you have seen in a hard effort' },
  restingHr: { label: 'Resting heart rate', unit: 'bpm', min: 30, max: 100, hint: 'Measured in the morning before getting up' },
  weight: { label: 'Weight', unit: 'kg', min: 30, max: 200, hint: 'Used for W/kg' },
};

export const emptyThresholds = (): Thresholds =>
  Object.fromEntries(THRESHOLD_METRICS.map((m) => [m, null])) as Thresholds;

/** m/s → seconds per km */
export const paceFromSpeed = (mps: number) => 1000 / mps;
/** seconds per km → m/s */
export const speedFromPace = (secPerKm: number) => 1000 / secPerKm;

/** 270 → "4:30" */
export const formatPace = (secPerKm: number) => {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** "4:30" or "4.30" → 270 seconds per km; null if not a pace. */
export function parsePace(text: string): number | null {
  const m = /^\s*(\d{1,2})\s*[:.]\s*([0-5]\d)\s*$/.exec(text);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** A threshold's value as shown in forms ("4:30" for pace, plain number otherwise). */
export const displayThreshold = (metric: ThresholdMetric, value: number | null) =>
  value === null ? '' : metric === 'thresholdSpeed' ? formatPace(paceFromSpeed(value)) : String(Math.round(value * 10) / 10);
