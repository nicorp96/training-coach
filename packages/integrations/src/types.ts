// Ports that every activity/workout integration implements. Vendors live in ./<vendor>.
import type { SportId } from '@tc/core';

export type ActivityProvider = 'strava';

/** A finished activity, normalized to SI units, independent of the vendor. */
export type NormalizedActivity = {
  provider: ActivityProvider;
  externalId: string;
  sport: SportId;
  name: string;
  /** UTC start. */
  startAt: Date;
  /** Wall-clock start in the athlete's timezone (YYYY-MM-DD, HH:mm). */
  localDate: string;
  localTime: string;
  movingSec: number;
  elapsedSec: number;
  distanceM: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgWatts: number | null;
  normalizedWatts: number | null;
  /** m/s */
  avgSpeed: number | null;
};

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string;
  externalUserId?: string;
};

/** Reads finished activities from a vendor account (read-only). */
export interface ActivitySource {
  authorizeUrl(opts: { redirectUri: string; state: string }): string;
  exchangeCode(code: string): Promise<OAuthTokens>;
  refresh(refreshToken: string): Promise<OAuthTokens>;
  revoke(accessToken: string): Promise<void>;
  /** Activities that started after `after`, oldest first. Unsupported sports are skipped. */
  listActivities(accessToken: string, opts: { after: Date; maxPages?: number }): Promise<NormalizedActivity[]>;
}

export class IntegrationError extends Error {
  constructor(message: string, readonly status: number, readonly code: 'unauthorized' | 'rate_limited' | 'upstream') {
    super(message);
  }
}
