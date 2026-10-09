import type { DeviceProvider } from './types';

export const DEVICE_PROVIDERS: { id: DeviceProvider; name: string; short: string; sub: string }[] = [
  { id: 'garmin', name: 'Garmin Connect', short: 'Garmin', sub: 'Forerunner, fēnix, Edge' },
  { id: 'wahoo', name: 'Wahoo', short: 'Wahoo', sub: 'ELEMNT bike computers, KICKR' },
  { id: 'coros', name: 'COROS', short: 'COROS', sub: 'PACE, APEX, VERTIX' },
];
