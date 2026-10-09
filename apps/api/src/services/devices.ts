import { eq } from 'drizzle-orm';
import { DEVICE_PROVIDERS, type DeviceDto, type DeviceProvider } from '@tc/core';
import { db } from '../db/client';
import { deviceConnection } from '../db/schema';

export async function listDevices(athleteId: string): Promise<DeviceDto[]> {
  const rows = await db.select().from(deviceConnection).where(eq(deviceConnection.athleteId, athleteId));
  return DEVICE_PROVIDERS.map(({ id }) => {
    const r = rows.find((x) => x.provider === id);
    return {
      provider: id,
      connected: r?.connected ?? false,
      importActivities: r?.importActivities ?? true,
      pushWorkouts: r?.pushWorkouts ?? true,
      lastSyncAt: r?.lastSyncAt?.toISOString() ?? null,
    };
  });
}

/**
 * Simulated until partner API access exists (PLAN.md §8): "connecting" just flips the flag.
 * The real implementation will start an OAuth flow and store encrypted tokens.
 */
export async function updateDevice(
  athleteId: string,
  provider: DeviceProvider,
  patch: Partial<Pick<DeviceDto, 'connected' | 'importActivities' | 'pushWorkouts'>>,
) {
  const values = { ...patch, ...(patch.connected ? { lastSyncAt: new Date() } : {}) };
  await db
    .insert(deviceConnection)
    .values({ athleteId, provider, ...values })
    .onConflictDoUpdate({ target: [deviceConnection.athleteId, deviceConnection.provider], set: values });
  return listDevices(athleteId);
}
