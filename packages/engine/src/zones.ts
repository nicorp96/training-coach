// Training zones from an athlete's thresholds. Pure: no I/O, no clock.
import { formatPace, paceFromSpeed, type Thresholds } from '@tc/core';

export type ZoneKind = 'power' | 'hr' | 'pace';

export type Zone = {
  id: string;
  name: string;
  purpose: string;
  /**
   * Inclusive range in the zone's display unit (W, bpm, or seconds per km).
   * For pace, `lo` is the faster (smaller) end. `null` = open-ended.
   */
  lo: number | null;
  hi: number | null;
};

type Def = Pick<Zone, 'id' | 'name' | 'purpose'>;

/** Integer zones: `bounds[i]` is the first value of zone i+1. */
function integerZones(defs: Def[], bounds: number[]): Zone[] {
  return defs.map((d, i) => ({ ...d, lo: i === 0 ? null : bounds[i - 1]!, hi: i === defs.length - 1 ? null : bounds[i]! - 1 }));
}

const POWER: Def[] = [
  { id: 'Z1', name: 'Active recovery', purpose: 'Easy spinning, recovery rides' },
  { id: 'Z2', name: 'Endurance', purpose: 'Long rides, aerobic base' },
  { id: 'Z3', name: 'Tempo', purpose: 'Steady, comfortably hard' },
  { id: 'Z4', name: 'Threshold', purpose: 'Sweet spot and FTP intervals' },
  { id: 'Z5', name: 'VO2max', purpose: '3–8 min intervals' },
  { id: 'Z6', name: 'Anaerobic', purpose: '30 s – 2 min efforts' },
  { id: 'Z7', name: 'Neuromuscular', purpose: 'Sprints' },
];

/** Coggan power zones (% of FTP). */
export function powerZones(ftp: number): Zone[] {
  return integerZones(POWER, [0.56, 0.76, 0.91, 1.06, 1.21, 1.51].map((p) => Math.round(p * ftp)));
}

const HR: Def[] = [
  { id: 'Z1', name: 'Recovery', purpose: 'Very easy, warm-up' },
  { id: 'Z2', name: 'Aerobic', purpose: 'Most of your training' },
  { id: 'Z3', name: 'Tempo', purpose: 'Marathon effort' },
  { id: 'Z4', name: 'Threshold', purpose: 'Just below threshold' },
  { id: 'Z5', name: 'VO2max', purpose: 'Above threshold, short intervals' },
];

export type HrZones = { basis: 'lthr' | 'maxHr'; zones: Zone[] };

/** Heart-rate zones: Friel (% of threshold HR) when known, otherwise % of max HR. */
export function hrZones({ lthr, maxHr }: Pick<Thresholds, 'lthr' | 'maxHr'>): HrZones | null {
  if (lthr) return { basis: 'lthr', zones: integerZones(HR, [0.85, 0.9, 0.95, 1.0].map((p) => Math.round(p * lthr))) };
  if (maxHr) return { basis: 'maxHr', zones: integerZones(HR, [0.6, 0.7, 0.8, 0.9].map((p) => Math.round(p * maxHr))) };
  return null;
}

const PACE: Def[] = [
  { id: 'Z1', name: 'Recovery', purpose: 'Recovery jogs' },
  { id: 'Z2', name: 'Endurance', purpose: 'Easy and long runs' },
  { id: 'Z3', name: 'Tempo', purpose: 'Marathon to half-marathon pace' },
  { id: 'Z4', name: 'Threshold', purpose: 'Cruise intervals, 10k to hour pace' },
  { id: 'Z5', name: 'VO2max', purpose: '5k pace and faster' },
];

/** Running pace zones (Friel, % of threshold pace time). Input m/s, output seconds per km. */
export function paceZones(thresholdSpeed: number): Zone[] {
  const t = paceFromSpeed(thresholdSpeed);
  // Slowest → fastest boundaries; pace is continuous, so adjacent zones share a boundary.
  const b = [1.29, 1.14, 1.06, 1.0].map((p) => Math.round(p * t));
  return PACE.map((d, i) => ({ ...d, lo: i === PACE.length - 1 ? null : b[i]!, hi: i === 0 ? null : b[i - 1]! }));
}

export function zonesFor(t: Thresholds) {
  return {
    power: t.ftp ? powerZones(t.ftp) : null,
    hr: hrZones(t),
    pace: t.thresholdSpeed ? paceZones(t.thresholdSpeed) : null,
  };
}

export const wattsPerKg = (t: Pick<Thresholds, 'ftp' | 'weight'>) =>
  t.ftp && t.weight ? Math.round((t.ftp / t.weight) * 100) / 100 : null;

/** Human-readable range, e.g. "165–224 W", "≤ 132 bpm", "5:10–5:48 /km". */
export function formatZone(z: Zone, kind: ZoneKind): string {
  if (kind === 'pace') {
    if (z.lo === null) return `faster than ${formatPace(z.hi!)} /km`;
    if (z.hi === null) return `slower than ${formatPace(z.lo)} /km`;
    return `${formatPace(z.lo)}–${formatPace(z.hi)} /km`;
  }
  const unit = kind === 'power' ? 'W' : 'bpm';
  if (z.lo === null) return `≤ ${z.hi} ${unit}`;
  if (z.hi === null) return `≥ ${z.lo} ${unit}`;
  return `${z.lo}–${z.hi} ${unit}`;
}
