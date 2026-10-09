'use client';

import { useMemo } from 'react';
import {
  DEVICE_PROVIDERS,
  SPORTS,
  fromMinutes,
  getExercise,
  localIso,
  shortDate,
  toMinutes,
  type SessionDto,
  type SessionSource,
} from '@tc/core';
import { useDevices } from './queries';

export const SOURCES: Record<SessionSource, { label: string; long: string; bg: string; color: string }> = {
  coach: { label: 'Coach', long: 'Planned by your coach', bg: '#E9EDD6', color: '#4A5620' },
  me: { label: 'You', long: 'Added by you', bg: '#ECECE5', color: '#2F3129' },
  past: { label: 'Repeat', long: 'Repeated from', bg: '#F1ECE1', color: '#6E5A35' },
};

export const sourceLong = (x: { source: SessionSource; repeatedFrom?: string | null }) =>
  x.source === 'past' && x.repeatedFrom ? `${SOURCES.past.long} ${shortDate(x.repeatedFrom)}` : SOURCES[x.source].long;

export function useToday() {
  return useMemo(() => localIso(), []);
}

export type SessionExerciseView = {
  rowId: string;
  index: number;
  n: string;
  name: string;
  group: string;
  muscles: string;
  cue: string;
  rx: string;
  load: string;
  done: boolean;
};

export type SessionView = SessionDto & {
  sportLabel: string;
  color: string;
  end: string;
  exs: SessionExerciseView[];
  nDone: number;
  complete: boolean;
  progress: string;
  pct: number;
  statusLabel: string;
};

/** Derives display state (progress, completion, status) for a session. */
export function useSessionView() {
  const { data: devices } = useDevices();
  const today = useToday();
  const sync = devices?.find((d) => d.connected && d.importActivities);
  const syncName = sync ? DEVICE_PROVIDERS.find((p) => p.id === sync.provider)!.short : '';

  return (x: SessionDto): SessionView => {
    const sport = SPORTS[x.sport];
    const past = x.date < today;
    const exs = x.exercises.map((e, i) => {
      const E = getExercise(e.id);
      return {
        rowId: e.rowId,
        index: i,
        n: String(i + 1).padStart(2, '0'),
        name: E.name,
        group: E.group,
        muscles: E.muscles,
        cue: E.cue,
        rx: `${e.sets} × ${e.reps}`,
        load: e.load,
        done: e.done,
      };
    });
    const nDone = exs.filter((e) => e.done).length;
    const complete = !!x.completedAt || (exs.length > 0 && nDone === exs.length);
    return {
      ...x,
      sportLabel: sport.label,
      color: sport.color,
      end: fromMinutes(toMinutes(x.time) + x.durationMin),
      exs,
      nDone,
      complete,
      progress: exs.length ? `${nDone} of ${exs.length} done` : complete ? 'Done' : 'Not started',
      pct: exs.length ? (nDone / exs.length) * 100 : complete ? 100 : 0,
      statusLabel: complete
        ? sport.endurance && past && syncName ? `Done · ${syncName}` : 'Done'
        : x.date === today ? 'Today' : past ? 'Missed' : 'Planned',
    };
  };
}
