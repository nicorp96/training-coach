'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  SPORTS,
  addDays,
  getExercise,
  localIso,
  shortDate,
  startOfMonth,
  startOfWeek,
  type DeviceConnection,
  type DeviceProvider,
  type PlannedSession,
  type SessionExercise,
  type SessionSource,
  type SportId,
} from '@tc/core';
import { DEFAULT_DEVICES, DEFAULT_SPORTS, DEVICES, PROFILES, type ProfileId } from './mock-data';

export const VIEWS = {
  today: ['Focus', 'Timeline', 'Week'],
  calendar: ['Month', 'Week'],
  builder: ['Form', 'Guided'],
  strength: ['Grid', 'Groups'],
  settings: ['Cards', 'List'],
} as const;
export type Screen = keyof typeof VIEWS;
type ViewState = { [K in Screen]: (typeof VIEWS)[K][number] };

export type Draft = {
  title: string;
  sport: SportId;
  date: string;
  time: string;
  dur: string;
  dist: string;
  target: string;
  exercises: SessionExercise[];
  source: SessionSource;
  repeatedFrom: string | null;
  /** Key of the past/coach plan this draft was loaded from. */
  pick: string | null;
};

export type StartMode = 'blank' | 'past' | 'coach';
export type SourceFilter = 'all' | SessionSource;

type Toast = { msg: string; action?: string; onAction?: () => void } | null;

const today = () => localIso();
const newDraft = (): Draft => ({
  title: '', sport: 'strength', date: addDays(today(), 1), time: '07:00', dur: '45', dist: '', target: '',
  exercises: [], source: 'me', repeatedFrom: null, pick: null,
});

type State = {
  pid: ProfileId;
  customSessions: Record<ProfileId, PlannedSession[]>;
  doneExercises: Record<string, boolean>;
  completed: Record<string, boolean>;
  sports: Record<ProfileId, SportId[]>;
  devices: Record<ProfileId, Partial<Record<DeviceProvider, DeviceConnection & { busy?: boolean }>>>;
  views: ViewState;

  selSession: string | null;
  calMonth: string;
  weekStart: string;
  selDate: string;
  srcFilter: SourceFilter;
  draft: Draft;
  step: 1 | 2 | 3;
  startMode: StartMode;
  q: string;
  grp: string;
  libGrp: string;
  toast: Toast;
};

type Actions = {
  set: (patch: Partial<State>) => void;
  setView: <K extends Screen>(screen: K, v: ViewState[K]) => void;
  switchProfile: (pid: ProfileId) => void;
  flash: (msg: string, action?: string, onAction?: () => void) => void;
  toggleExerciseDone: (sessionId: string, i: number) => void;
  setCompleted: (sessionId: string, value: boolean) => void;
  updateDraft: (patch: Partial<Draft>) => void;
  resetDraft: () => void;
  toggleDraftExercise: (id: string) => boolean;
  updateDraftExercise: (i: number, patch: Partial<SessionExercise>) => void;
  removeDraftExercise: (i: number) => void;
  loadPlan: (p: { title: string; sport: SportId; durationMin: number; exercises: SessionExercise[]; date?: string }, source: SessionSource, key: string) => void;
  saveDraft: () => PlannedSession;
  goToDate: (date: string) => void;
  toggleSport: (id: SportId) => void;
  setDevice: (id: DeviceProvider, patch: Partial<DeviceConnection & { busy?: boolean }>) => void;
  toggleConnection: (id: DeviceProvider) => void;
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      pid: 'lena',
      customSessions: { lena: [], jonas: [], mia: [] },
      doneExercises: {},
      completed: {},
      sports: structuredClone(DEFAULT_SPORTS),
      devices: structuredClone(DEFAULT_DEVICES),
      views: { today: 'Focus', calendar: 'Month', builder: 'Form', strength: 'Grid', settings: 'Cards' },

      selSession: null,
      calMonth: startOfMonth(today()),
      weekStart: startOfWeek(today()),
      selDate: today(),
      srcFilter: 'all',
      draft: newDraft(),
      step: 1,
      startMode: 'blank',
      q: '',
      grp: 'All',
      libGrp: 'Legs',
      toast: null,

      set: (patch) => set(patch),
      setView: (screen, v) => set((s) => ({ views: { ...s.views, [screen]: v } })),
      switchProfile: (pid) => {
        set({ pid, selSession: null });
        get().flash(`Switched to ${PROFILES[pid].firstName}`);
      },
      flash: (msg, action, onAction) => {
        clearTimeout(toastTimer);
        set({ toast: { msg, action, onAction } });
        toastTimer = setTimeout(() => set({ toast: null }), 3200);
      },
      toggleExerciseDone: (sessionId, i) =>
        set((s) => ({ doneExercises: { ...s.doneExercises, [`${sessionId}:${i}`]: !s.doneExercises[`${sessionId}:${i}`] } })),
      setCompleted: (sessionId, value) => set((s) => ({ completed: { ...s.completed, [sessionId]: value } })),
      updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      resetDraft: () => set({ draft: newDraft() }),
      toggleDraftExercise: (id) => {
        const has = get().draft.exercises.some((e) => e.id === id);
        const { defaults } = getExercise(id);
        set((s) => ({
          draft: {
            ...s.draft,
            exercises: has ? s.draft.exercises.filter((e) => e.id !== id) : [...s.draft.exercises, { id, ...defaults }],
          },
        }));
        return !has;
      },
      updateDraftExercise: (i, patch) =>
        set((s) => ({ draft: { ...s.draft, exercises: s.draft.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) } })),
      removeDraftExercise: (i) => set((s) => ({ draft: { ...s.draft, exercises: s.draft.exercises.filter((_, j) => j !== i) } })),
      loadPlan: (p, source, key) => {
        set((s) => ({
          draft: {
            ...s.draft, title: p.title, sport: p.sport, dur: String(p.durationMin),
            exercises: p.exercises.map((e) => ({ ...e })), source, repeatedFrom: p.date ?? null, pick: key,
          },
        }));
        get().flash(source === 'coach' ? `Loaded coach plan “${p.title}”` : `Copied “${p.title}” from ${shortDate(p.date!)}`);
      },
      saveDraft: () => {
        const { draft: d, pid } = get();
        const sport = SPORTS[d.sport];
        const title = d.title.trim() || `${sport.label} session`;
        const date = d.date || today();
        const session: PlannedSession = {
          id: `n${Date.now()}`,
          date,
          sport: d.sport,
          title,
          time: d.time || '07:00',
          durationMin: parseInt(d.dur) || 45,
          exercises: d.exercises.map((e) => ({ ...e })),
          note: sport.endurance && (d.dist || d.target) ? [d.dist && `${d.dist} km`, d.target].filter(Boolean).join(' · ') : 'Custom training.',
          source: d.source,
          repeatedFrom: d.repeatedFrom,
        };
        set((s) => ({
          customSessions: { ...s.customSessions, [pid]: [...s.customSessions[pid], session] },
          draft: newDraft(),
          step: 1,
        }));
        get().goToDate(date);
        get().flash(`Saved “${title}” to ${shortDate(date)}`);
        return session;
      },
      goToDate: (date) => set({ selDate: date, calMonth: startOfMonth(date), weekStart: startOfWeek(date) }),
      toggleSport: (id) =>
        set((s) => {
          const cur = s.sports[s.pid];
          const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
          return next.length ? { sports: { ...s.sports, [s.pid]: next } } : {};
        }),
      setDevice: (id, patch) =>
        set((s) => {
          const cur = s.devices[s.pid] ?? {};
          return { devices: { ...s.devices, [s.pid]: { ...cur, [id]: { ...(cur[id] ?? { connected: false, importActivities: false, pushWorkouts: false }), ...patch } } } };
        }),
      toggleConnection: (id) => {
        const name = DEVICES.find((d) => d.id === id)!.name;
        const cur = get().devices[get().pid]?.[id];
        if (cur?.connected) {
          get().setDevice(id, { connected: false, busy: false });
          get().flash(`${name} disconnected`);
          return;
        }
        // Simulated OAuth round-trip until real integrations exist (see PLAN.md §8).
        get().setDevice(id, { busy: true });
        setTimeout(() => {
          get().setDevice(id, { busy: false, connected: true, importActivities: true, pushWorkouts: true, lastSync: 'Just now' });
          get().flash(`${name} connected`);
        }, 1200);
      },
    }),
    {
      name: 'training-coach',
      version: 1,
      partialize: (s) => ({
        pid: s.pid,
        customSessions: s.customSessions,
        doneExercises: s.doneExercises,
        completed: s.completed,
        sports: s.sports,
        devices: s.devices,
        views: s.views,
      }),
    },
  ),
);
