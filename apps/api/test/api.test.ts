import { describe, expect, it } from 'vitest';
import type { AthleteDto, MeDto, SessionDto, ThresholdEntryDto } from '@tc/core';
import { app } from '../src/app';
import { updateProfile } from '../src/services/athletes';

const ORIGIN = 'http://localhost:3000';

async function signUp(email: string, name: string) {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password: 'correct-horse-battery', name }),
  });
  expect(res.status).toBe(200);
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const call = (path: string, init: RequestInit = {}) =>
    app.request(`/api/v1${path}`, { ...init, headers: { cookie, origin: ORIGIN, 'content-type': 'application/json', ...init.headers } });
  const me = (await (await call('/me')).json()) as MeDto;
  return { call, me, athleteId: me.athletes[0]!.id };
}

const newSession = {
  date: '2026-10-12', time: '07:00', durationMin: 45, sport: 'strength', title: 'Leg day',
  exercises: [{ exerciseId: 'squat', sets: 4, reps: '6', load: '80 kg' }, { exerciseId: 'plank', sets: 3, reps: '45 s', load: 'BW' }],
};

describe('API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await app.request('/api/v1/me');
    expect(res.status).toBe(401);
  });

  it('creates an own athlete profile on sign-up', async () => {
    const { me } = await signUp('anna@example.com', 'Anna Schmidt');
    expect(me.athletes).toHaveLength(1);
    expect(me.athletes[0]).toMatchObject({ name: 'Anna Schmidt', initials: 'AS', role: 'owner' });
  });

  it('creates, lists, ticks and completes a session', async () => {
    const { call, athleteId } = await signUp('nico@example.com', 'Nico R');
    const created = await call(`/athletes/${athleteId}/sessions`, { method: 'POST', body: JSON.stringify(newSession) });
    expect(created.status).toBe(201);
    const s = (await created.json()) as SessionDto;
    expect(s.exercises.map((e) => e.id)).toEqual(['squat', 'plank']);

    const list = (await (await call(`/athletes/${athleteId}/sessions?from=2026-10-12&to=2026-10-12`)).json()) as SessionDto[];
    expect(list.map((x) => x.id)).toEqual([s.id]);

    const ticked = (await (await call(`/sessions/${s.id}/exercises/${s.exercises[0]!.rowId}`, { method: 'PATCH', body: JSON.stringify({ done: true }) })).json()) as SessionDto;
    expect(ticked.exercises.map((e) => e.done)).toEqual([true, false]);

    const done = (await (await call(`/sessions/${s.id}`, { method: 'PATCH', body: JSON.stringify({ completed: true, rpe: 7 }) })).json()) as SessionDto;
    expect(done.completedAt).not.toBeNull();
    expect(done.rpe).toBe(7);

    expect((await call(`/sessions/${s.id}`, { method: 'DELETE' })).status).toBe(204);
  });

  it('validates input', async () => {
    const { call, athleteId } = await signUp('val@example.com', 'Val');
    const res = await call(`/athletes/${athleteId}/sessions`, { method: 'POST', body: JSON.stringify({ ...newSession, time: '25:00' }) });
    expect(res.status).toBe(400);
    const unknown = await call(`/athletes/${athleteId}/sessions`, {
      method: 'POST', body: JSON.stringify({ ...newSession, exercises: [{ exerciseId: 'nope', sets: 1, reps: '1', load: '' }] }),
    });
    expect(unknown.status).toBe(400);
  });

  it("keeps one user's data private from another until shared", async () => {
    const a = await signUp('alice@example.com', 'Alice');
    const b = await signUp('bob@example.com', 'Bob');
    const s = (await (await a.call(`/athletes/${a.athleteId}/sessions`, { method: 'POST', body: JSON.stringify(newSession) })).json()) as SessionDto;

    expect((await b.call(`/athletes/${a.athleteId}`)).status).toBe(404);
    expect((await b.call(`/athletes/${a.athleteId}/sessions?from=2026-10-01&to=2026-10-31`)).status).toBe(404);
    expect((await b.call(`/sessions/${s.id}`)).status).toBe(404);
    expect((await b.call(`/sessions/${s.id}`, { method: 'PATCH', body: JSON.stringify({ completed: true }) })).status).toBe(404);

    // Alice shares read-only access with Bob.
    expect((await a.call(`/athletes/${a.athleteId}/access`, { method: 'POST', body: JSON.stringify({ email: 'bob@example.com', role: 'viewer' }) })).status).toBe(200);
    expect((await b.call(`/sessions/${s.id}`)).status).toBe(200);
    expect((await b.call(`/sessions/${s.id}`, { method: 'PATCH', body: JSON.stringify({ completed: true }) })).status).toBe(403);
    // Viewers can't re-share.
    expect((await b.call(`/athletes/${a.athleteId}/access`, { method: 'POST', body: JSON.stringify({ email: 'bob@example.com', role: 'coach' }) })).status).toBe(403);

    // Upgrade to coach: Bob can now edit, and sees Alice in his athlete list.
    await a.call(`/athletes/${a.athleteId}/access`, { method: 'POST', body: JSON.stringify({ email: 'bob@example.com', role: 'coach' }) });
    expect((await b.call(`/sessions/${s.id}`, { method: 'PATCH', body: JSON.stringify({ completed: true }) })).status).toBe(200);
    const me = (await (await b.call('/me')).json()) as MeDto;
    expect(me.athletes.map((x) => [x.name, x.role])).toEqual([['Bob', 'owner'], ['Alice', 'coach']]);
  });

  it('updates sports and devices', async () => {
    const { call, athleteId } = await signUp('sport@example.com', 'Sporty');
    const a = (await (await call(`/athletes/${athleteId}/sports`, { method: 'PUT', body: JSON.stringify({ sports: ['ride', 'run'] }) })).json()) as AthleteDto;
    expect(a.sports.sort()).toEqual(['ride', 'run']);
    const devices = (await (await call(`/athletes/${athleteId}/devices/garmin`, { method: 'PUT', body: JSON.stringify({ connected: true }) })).json()) as { provider: string; connected: boolean }[];
    expect(devices.find((d) => d.provider === 'garmin')?.connected).toBe(true);
  });

  it('updates profile and keeps a threshold history', async () => {
    const { call, athleteId } = await signUp('thr@example.com', 'Theo Rad');
    const patch = (body: object) => call(`/athletes/${athleteId}`, { method: 'PATCH', body: JSON.stringify(body) });

    // An older FTP test, as if entered months ago.
    await updateProfile(athleteId, { thresholds: { ftp: 230 } }, '2026-01-15');

    const res = await patch({ name: 'Theo Rader', goal: 'Ötztaler', goalDate: '2027-08-29', thresholds: { ftp: 250, lthr: 168, weight: 72 } });
    expect(res.status).toBe(200);
    const a = (await res.json()) as AthleteDto;
    expect(a).toMatchObject({ name: 'Theo Rader', initials: 'TR', goal: 'Ötztaler', goalDate: '2027-08-29' });
    expect(a.thresholds).toMatchObject({ ftp: 250, lthr: 168, weight: 72, maxHr: null, thresholdSpeed: null });

    // A second edit on the same day replaces that day's entry; clearing a value is recorded too.
    const b = (await (await patch({ thresholds: { ftp: 255, weight: null } })).json()) as AthleteDto;
    expect(b.thresholds).toMatchObject({ ftp: 255, weight: null, lthr: 168 });

    const history = (await (await call(`/athletes/${athleteId}/thresholds`)).json()) as ThresholdEntryDto[];
    expect(history.filter((h) => h.metric === 'ftp').map((h) => [h.value, h.validFrom])).toEqual([
      [255, b.thresholdsSince.ftp], [230, '2026-01-15'],
    ]);

    expect((await patch({ thresholds: { ftp: 5000 } })).status).toBe(400);
  });

  it('does not let viewers edit the profile', async () => {
    const a = await signUp('owner2@example.com', 'Owner Two');
    const v = await signUp('viewer2@example.com', 'Viewer Two');
    await a.call(`/athletes/${a.athleteId}/access`, { method: 'POST', body: JSON.stringify({ email: 'viewer2@example.com', role: 'viewer' }) });
    const res = await v.call(`/athletes/${a.athleteId}`, { method: 'PATCH', body: JSON.stringify({ thresholds: { ftp: 200 } }) });
    expect(res.status).toBe(403);
    expect((await v.call(`/athletes/${a.athleteId}/thresholds`)).status).toBe(200);
  });
});
