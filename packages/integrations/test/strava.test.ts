import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStravaClient, mapStravaActivity, type StravaActivity } from '../src';

const run: StravaActivity = {
  id: 123, name: 'Morning Run', sport_type: 'Run', type: 'Run',
  start_date: '2026-10-08T05:02:11Z', start_date_local: '2026-10-08T07:02:11Z',
  moving_time: 3000, elapsed_time: 3100, distance: 10050, total_elevation_gain: 42,
  average_heartrate: 148.3, max_heartrate: 171, average_speed: 3.35,
};

describe('mapStravaActivity', () => {
  it('normalizes a run with local wall-clock time', () => {
    expect(mapStravaActivity(run)).toMatchObject({
      provider: 'strava', externalId: '123', sport: 'run', localDate: '2026-10-08', localTime: '07:02',
      movingSec: 3000, distanceM: 10050, avgHr: 148.3, avgWatts: null,
    });
  });

  it('keeps measured power, drops estimated power', () => {
    const ride = { ...run, sport_type: 'VirtualRide', average_watts: 190, weighted_average_watts: 205 };
    expect(mapStravaActivity({ ...ride, device_watts: true })).toMatchObject({ sport: 'ride', avgWatts: 190, normalizedWatts: 205 });
    expect(mapStravaActivity({ ...ride, device_watts: false })).toMatchObject({ avgWatts: null, normalizedWatts: null });
  });

  it('skips sports we do not support yet', () => {
    expect(mapStravaActivity({ ...run, sport_type: 'Swim', type: 'Swim' })).toBeNull();
  });

  it('falls back to the legacy type field', () => {
    expect(mapStravaActivity({ ...run, sport_type: undefined, type: 'WeightTraining' })?.sport).toBe('strength');
  });
});

describe('createStravaClient', () => {
  afterEach(() => vi.unstubAllGlobals());
  const client = createStravaClient({ clientId: '42', clientSecret: 'shh' });

  it('builds a read-only authorize URL', () => {
    const url = new URL(client.authorizeUrl({ redirectUri: 'http://localhost:3000/cb', state: 'xyz' }));
    expect(url.searchParams.get('scope')).toBe('read,activity:read_all');
    expect(url.searchParams.get('state')).toBe('xyz');
  });

  it('pages through activities and maps them', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ ...run, id: i, start_date: `2026-10-0${(i % 9) + 1}T05:00:00Z` }));
    const page2 = [{ ...run, id: 999, sport_type: 'Swim' }];
    const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(new URL(url).searchParams.get('page') === '1' ? page1 : page2)));
    vi.stubGlobal('fetch', fetch);
    const list = await client.listActivities('tok', { after: new Date('2026-10-01') });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(list).toHaveLength(100);
    expect(list[0]!.startAt <= list[99]!.startAt).toBe(true);
  });

  it('turns 401 and 429 into typed errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })));
    await expect(client.listActivities('tok', { after: new Date() })).rejects.toMatchObject({ code: 'rate_limited' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    await expect(client.listActivities('tok', { after: new Date() })).rejects.toMatchObject({ code: 'unauthorized' });
  });
});
