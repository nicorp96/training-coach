'use client';

// UI state only. Server data (sessions, athletes, devices) lives in TanStack Query (lib/queries.ts).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  addDays,
  getExercise,
  localIso,
  startOfMonth,
  startOfWeek,
  type SessionExercise,
  type SessionSource,
  type SportId,
} from '@tc/core';

export const VIEWS = {
  today: ['Focus', 'Timeline', 'Week'],
  calendar: ['Month', 'Week'],
  builder: ['Form', 'Guided'],
  strength: ['Grid', 'Groups'],
  profile: ['Bars', 'Table'],
  settings: ['Cards', 'List'],
} as const;
export type Screen = keyof typeof VIEWS;
type ViewState = { [K in Screen]: (typeof VIEWS)[K][number] };
const DEFAULT_VIEWS: ViewState = { today: 'Focus', calendar: 'Month', builder: 'Form', strength: 'Grid', profile: 'Bars', settings: 'Cards' };

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
export const newDraft = (): Draft => ({
  title: '', sport: 'strength', date: addDays(today(), 1), time: '07:00', dur: '45', dist: '', target: '',
  exercises: [], source: 'me', repeatedFrom: null, pick: null,
});

type State = {
  /** Athlete selected in the profile switcher (null = own profile). */
  athleteId: string | null;
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
  flash: (msg: string, action?: string, onAction?: () => void) => void;
  updateDraft: (patch: Partial<Draft>) => void;
  resetDraft: () => void;
  toggleDraftExercise: (id: string) => boolean;
  updateDraftExercise: (i: number, patch: Partial<SessionExercise>) => void;
  removeDraftExercise: (i: number) => void;
  goToDate: (date: string) => void;
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      athleteId: null,
      views: DEFAULT_VIEWS,
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
      flash: (msg, action, onAction) => {
        clearTimeout(toastTimer);
        set({ toast: { msg, action, onAction } });
        toastTimer = setTimeout(() => set({ toast: null }), 3200);
      },
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
      goToDate: (date) => set({ selDate: date, calMonth: startOfMonth(date), weekStart: startOfWeek(date) }),
    }),
    {
      name: 'training-coach-ui',
      version: 3,
      // v3 added the profile screen; keep stored views but fill in new screens.
      migrate: (persisted) => {
        const p = persisted as { athleteId?: string | null; views?: Partial<ViewState> } | undefined;
        return { athleteId: p?.athleteId ?? null, views: { ...DEFAULT_VIEWS, ...p?.views } } as never;
      },
      partialize: (s) => ({ athleteId: s.athleteId, views: s.views }),
    },
  ),
);
