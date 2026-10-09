'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AthleteDto,
  CreateSessionInput,
  DeviceDto,
  DeviceProvider,
  IntegrationDto,
  MeDto,
  SessionDto,
  SportId,
  SuggestionDto,
  SyncResultDto,
  ThresholdEntryDto,
  UpdateProfileInput,
  UpdateSessionInput,
} from '@tc/core';
import { api, unwrap } from './api';
import { useStore } from './store';

export const keys = {
  me: ['me'] as const,
  athlete: (aid: string) => ['athlete', aid] as const,
  sessions: (aid: string) => ['sessions', aid] as const,
  sessionsRange: (aid: string, from: string, to: string) => ['sessions', aid, from, to] as const,
  suggestions: (aid: string) => ['suggestions', aid] as const,
  devices: (aid: string) => ['devices', aid] as const,
  thresholds: (aid: string) => ['thresholds', aid] as const,
  integrations: (aid: string) => ['integrations', aid] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => unwrap<MeDto>(api.me.$get()) });
}

/** The athlete currently shown (profile switcher), falling back to the user's own profile. */
export function useActiveAthleteId(): string | null {
  const { data } = useMe();
  const selected = useStore((s) => s.athleteId);
  if (!data) return null;
  return data.athletes.find((a) => a.id === selected)?.id ?? data.athletes[0]?.id ?? null;
}

export function useAthlete() {
  const aid = useActiveAthleteId();
  return useQuery({
    queryKey: keys.athlete(aid ?? ''),
    enabled: !!aid,
    queryFn: () => unwrap<AthleteDto>(api.athletes[':aid'].$get({ param: { aid: aid! } })),
  });
}

export function useSessionsRange(from: string, to: string) {
  const aid = useActiveAthleteId();
  return useQuery({
    queryKey: keys.sessionsRange(aid ?? '', from, to),
    enabled: !!aid,
    queryFn: () => unwrap<SessionDto[]>(api.athletes[':aid'].sessions.$get({ param: { aid: aid! }, query: { from, to } })),
    placeholderData: (prev) => prev,
  });
}

export function useSuggestions() {
  const aid = useActiveAthleteId();
  return useQuery({
    queryKey: keys.suggestions(aid ?? ''),
    enabled: !!aid,
    queryFn: () => unwrap<SuggestionDto[]>(api.athletes[':aid'].suggestions.$get({ param: { aid: aid! } })),
  });
}

export function useDevices() {
  const aid = useActiveAthleteId();
  return useQuery({
    queryKey: keys.devices(aid ?? ''),
    enabled: !!aid,
    queryFn: () => unwrap<DeviceDto[]>(api.athletes[':aid'].devices.$get({ param: { aid: aid! } })),
  });
}

export function useThresholdHistory() {
  const aid = useActiveAthleteId();
  return useQuery({
    queryKey: keys.thresholds(aid ?? ''),
    enabled: !!aid,
    queryFn: () => unwrap<ThresholdEntryDto[]>(api.athletes[':aid'].thresholds.$get({ param: { aid: aid! } })),
  });
}

export function useIntegrations() {
  const aid = useActiveAthleteId();
  return useQuery({
    queryKey: keys.integrations(aid ?? ''),
    enabled: !!aid,
    queryFn: () => unwrap<IntegrationDto[]>(api.athletes[':aid'].integrations.$get({ param: { aid: aid! } })),
  });
}

// ---- Mutations ----

/** Applies `fn` to every cached session list of the athlete (optimistic updates). */
function useSessionCache() {
  const qc = useQueryClient();
  const aid = useActiveAthleteId();
  return {
    aid,
    async patch(fn: (s: SessionDto) => SessionDto) {
      await qc.cancelQueries({ queryKey: keys.sessions(aid!) });
      const snapshot = qc.getQueriesData<SessionDto[]>({ queryKey: keys.sessions(aid!) });
      qc.setQueriesData<SessionDto[]>({ queryKey: keys.sessions(aid!) }, (old) => old?.map(fn));
      return () => snapshot.forEach(([k, v]) => qc.setQueryData(k, v));
    },
    replace(updated: SessionDto) {
      qc.setQueriesData<SessionDto[]>({ queryKey: keys.sessions(aid!) }, (old) => old?.map((s) => (s.id === updated.id ? updated : s)));
    },
    invalidate: () => qc.invalidateQueries({ queryKey: keys.sessions(aid!) }),
  };
}

export function useCreateSession() {
  const cache = useSessionCache();
  return useMutation({
    mutationFn: (input: CreateSessionInput) =>
      unwrap<SessionDto>(api.athletes[':aid'].sessions.$post({ param: { aid: cache.aid! }, json: input })),
    onSuccess: () => cache.invalidate(),
  });
}

export function useUpdateSession() {
  const cache = useSessionCache();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateSessionInput & { id: string }) =>
      unwrap<SessionDto>(api.sessions[':sid'].$patch({ param: { sid: id }, json: input })),
    onMutate: ({ id, completed }) =>
      completed === undefined
        ? undefined
        : cache.patch((s) =>
            s.id !== id ? s : {
              ...s,
              completedAt: completed ? new Date().toISOString() : null,
              exercises: completed ? s.exercises : s.exercises.map((e) => ({ ...e, done: false })),
            },
          ),
    onError: (_e, _v, rollback) => rollback?.(),
    onSuccess: (updated) => cache.replace(updated),
  });
}

export function useToggleExercise() {
  const cache = useSessionCache();
  return useMutation({
    mutationFn: ({ sessionId, rowId, done }: { sessionId: string; rowId: string; done: boolean }) =>
      unwrap<SessionDto>(api.sessions[':sid'].exercises[':rowId'].$patch({ param: { sid: sessionId, rowId }, json: { done } })),
    onMutate: ({ sessionId, rowId, done }) =>
      cache.patch((s) => (s.id !== sessionId ? s : { ...s, exercises: s.exercises.map((e) => (e.rowId === rowId ? { ...e, done } : e)) })),
    onError: (_e, _v, rollback) => rollback?.(),
    onSuccess: (updated) => cache.replace(updated),
  });
}

export function useSetSports() {
  const qc = useQueryClient();
  const aid = useActiveAthleteId();
  return useMutation({
    mutationFn: (sports: SportId[]) => unwrap<AthleteDto>(api.athletes[':aid'].sports.$put({ param: { aid: aid! }, json: { sports } })),
    onSuccess: (a) => qc.setQueryData(keys.athlete(a.id), a),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const aid = useActiveAthleteId();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => unwrap<AthleteDto>(api.athletes[':aid'].$patch({ param: { aid: aid! }, json: input })),
    onSuccess: (a) => {
      qc.setQueryData(keys.athlete(a.id), a);
      // Name, initials and goal also show in the profile switcher.
      qc.invalidateQueries({ queryKey: keys.me });
      qc.invalidateQueries({ queryKey: keys.thresholds(a.id) });
    },
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  const aid = useActiveAthleteId();
  return useMutation({
    mutationFn: ({ provider, ...patch }: { provider: DeviceProvider; connected?: boolean; importActivities?: boolean; pushWorkouts?: boolean }) =>
      unwrap<DeviceDto[]>(api.athletes[':aid'].devices[':provider'].$put({ param: { aid: aid!, provider }, json: patch })),
    onSuccess: (devices) => qc.setQueryData(keys.devices(aid!), devices),
  });
}

export function useShareAccess() {
  const aid = useActiveAthleteId();
  return useMutation({
    mutationFn: (input: { email: string; role: 'coach' | 'viewer' }) =>
      unwrap<{ ok: boolean }>(api.athletes[':aid'].access.$post({ param: { aid: aid! }, json: input })),
  });
}

/** Starts the Strava OAuth flow: the browser leaves the app and comes back to /settings. */
export function useConnectStrava() {
  const aid = useActiveAthleteId();
  return useMutation({
    mutationFn: () => unwrap<{ url: string }>(api.athletes[':aid'].integrations.strava.connect.$post({ param: { aid: aid! } })),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

export function useSyncStrava() {
  const qc = useQueryClient();
  const aid = useActiveAthleteId();
  return useMutation({
    mutationFn: () => unwrap<SyncResultDto>(api.athletes[':aid'].integrations.strava.sync.$post({ param: { aid: aid! } })),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.integrations(aid!) });
      qc.invalidateQueries({ queryKey: keys.sessions(aid!) });
    },
  });
}

export function useDisconnectStrava() {
  const qc = useQueryClient();
  const aid = useActiveAthleteId();
  return useMutation({
    mutationFn: () => unwrap<void>(api.athletes[':aid'].integrations.strava.$delete({ param: { aid: aid! } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.integrations(aid!) }),
  });
}
