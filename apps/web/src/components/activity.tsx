'use client';

import { SPORTS, formatPace, type ActivityDto, type SportId } from '@tc/core';
import { cx } from './ui';

const duration = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

/** "10.05 km · 50:00 · 4:58 /km · ♥ 148 · 190 W" — speed shown as pace or km/h depending on the sport's zone type. */
export function activityStats(a: ActivityDto, sport: SportId): string[] {
  const out: string[] = [];
  if (a.distanceM) out.push(`${(a.distanceM / 1000).toFixed(a.distanceM < 10_000 ? 2 : 1)} km`);
  out.push(duration(a.movingSec));
  if (a.avgSpeed && a.distanceM) out.push(SPORTS[sport].zoneKind === 'pace' ? `${formatPace(1000 / a.avgSpeed)} /km` : `${(a.avgSpeed * 3.6).toFixed(1)} km/h`);
  if (a.avgHr) out.push(`♥ ${Math.round(a.avgHr)}`);
  if (a.normalizedWatts ?? a.avgWatts) out.push(`${Math.round((a.normalizedWatts ?? a.avgWatts)!)} W${a.normalizedWatts ? ' NP' : ''}`);
  if (a.elevationGainM && a.elevationGainM >= 20) out.push(`↑ ${Math.round(a.elevationGainM)} m`);
  return out;
}

/** What was actually done, from the imported activity. */
export function ActivityLine({ activity, sport, className }: { activity: ActivityDto; sport: SportId; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-strava-line bg-strava-soft px-3 py-2', className)}>
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[.06em] text-strava">Strava</span>
      <span className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[12.5px] text-ink-2">
        {activityStats(activity, sport).map((s) => <span key={s}>{s}</span>)}
      </span>
      <a href={activity.externalUrl} target="_blank" rel="noreferrer" className="ml-auto text-[12px] font-medium text-strava underline-offset-2 hover:underline">
        View on Strava
      </a>
    </div>
  );
}
