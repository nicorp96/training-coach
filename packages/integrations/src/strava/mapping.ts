import type { SportId } from '@tc/core';
import type { NormalizedActivity } from '../types';

/** The subset of Strava's SummaryActivity we read. */
export type StravaActivity = {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  /** Local wall-clock time, formatted with a misleading trailing "Z". */
  start_date_local: string;
  moving_time: number;
  elapsed_time: number;
  distance?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  device_watts?: boolean;
  average_speed?: number;
};

/** Strava sport types → our sports. Anything else (swim, walk, ski, …) is skipped for now. */
const SPORT_MAP: Record<string, SportId> = {
  Run: 'run', TrailRun: 'run', VirtualRun: 'run',
  Ride: 'ride', VirtualRide: 'ride', GravelRide: 'ride', MountainBikeRide: 'ride', EBikeRide: 'ride', EMountainBikeRide: 'ride',
  WeightTraining: 'strength', Crossfit: 'strength', Workout: 'strength', HighIntensityIntervalTraining: 'strength',
  Yoga: 'mobility', Pilates: 'mobility',
  Soccer: 'sport', Basketball: 'sport', Volleyball: 'sport', Tennis: 'sport', Badminton: 'sport', Squash: 'sport',
  Handball: 'sport', Hockey: 'sport', Rugby: 'sport', TableTennis: 'sport', Padel: 'sport', Pickleball: 'sport',
};

/** `sport_type` is authoritative; the legacy `type` is only used when it is missing. */
export const stravaSport = (a: Pick<StravaActivity, 'sport_type' | 'type'>): SportId | null =>
  SPORT_MAP[a.sport_type ?? a.type ?? ''] ?? null;

const num = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

export function mapStravaActivity(a: StravaActivity): NormalizedActivity | null {
  const sport = stravaSport(a);
  if (!sport) return null;
  return {
    provider: 'strava',
    externalId: String(a.id),
    sport,
    name: a.name.trim() || 'Activity',
    startAt: new Date(a.start_date),
    localDate: a.start_date_local.slice(0, 10),
    localTime: a.start_date_local.slice(11, 16),
    movingSec: a.moving_time,
    elapsedSec: a.elapsed_time,
    distanceM: num(a.distance),
    elevationGainM: num(a.total_elevation_gain),
    avgHr: num(a.average_heartrate),
    maxHr: num(a.max_heartrate),
    // Estimated power (no power meter) is not worth showing as if it were measured.
    avgWatts: a.device_watts ? num(a.average_watts) : null,
    normalizedWatts: a.device_watts ? num(a.weighted_average_watts) : null,
    avgSpeed: num(a.average_speed),
  };
}
