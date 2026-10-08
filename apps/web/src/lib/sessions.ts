'use client';

import { useMemo } from 'react';
import {
  SPORTS,
  fromMinutes,
  getExercise,
  localIso,
  shortDate,
  toMinutes,
  type PlannedSession,
  type SessionSource,
} from '@tc/core';
import { DEVICES, generateSessions } from './mock-data';
import { useStore } from './store';

export const SOURCES: Record<SessionSource, { label: string; long: string; bg: string; color: string }> = {
  coach: { label: 'Coach', long: 'Planned by your coach', bg: '#E9EDD6', color: '#4A5620' },
  me: { label: 'You', long: 'Added by you', bg: '#ECECE5', color: '#2F3129' },
  past: { label: 'Repeat', long: 'Repeated from', bg: '#F1ECE1', color: '#6E5A35' },
};

export const sourceLong = (x: Pick<PlannedSession, 'source' | 'repeatedFrom'>) =>
  x.source === 'past' && x.repeatedFrom ? `${SOURCES.past.long} ${shortDate(x.repeatedFrom)}` : SOURCES[x.source].long;

export function useToday() {
  return useMemo(() => localIso(), []);
}

/** All sessions of the active profile, sorted by date and time. */
export function useSessions() {
  const pid = useStore((s) => s.pid);
  const custom = useStore((s) => s.customSessions[pid]);
  const today = useToday();
  const generated = useMemo(() => generateSessions(pid, today), [pid, today]);
  return useMemo(
    () => [...generated, ...custom].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [generated, custom],
  );
}

export type SessionExerciseView = {
  n: string;
  name: string;
  group: string;
  muscles: string;
  cue: string;
  rx: string;
  load: string;
  done: boolean;
};

export type SessionView = PlannedSession & {
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
  const doneExercises = useStore((s) => s.doneExercises);
  const completed = useStore((s) => s.completed);
  const devices = useStore((s) => s.devices[s.pid]);
  const today = useToday();
  const syncName = DEVICES.find((d) => devices?.[d.id]?.connected && devices[d.id]?.importActivities)?.short ?? '';

  return (x: PlannedSession): SessionView => {
    const sport = SPORTS[x.sport];
    const past = x.date < today;
    const exs = x.exercises.map((e, i) => {
      const E = getExercise(e.id);
      return {
        n: String(i + 1).padStart(2, '0'),
        name: E.name,
        group: E.group,
        muscles: E.muscles,
        cue: E.cue,
        rx: `${e.sets} × ${e.reps}`,
        load: e.load,
        done: past || !!doneExercises[`${x.id}:${i}`],
      };
    });
    const nDone = exs.filter((e) => e.done).length;
    const complete = past || !!completed[x.id] || (exs.length > 0 && nDone === exs.length);
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
