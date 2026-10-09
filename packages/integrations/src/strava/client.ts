// Strava API v3, read-only (scope activity:read_all). Docs: https://developers.strava.com/docs/reference/
import { IntegrationError, type ActivitySource, type NormalizedActivity, type OAuthTokens } from '../types';
import { mapStravaActivity, type StravaActivity } from './mapping';

const AUTH = 'https://www.strava.com/oauth';
const API = 'https://www.strava.com/api/v3';
const PER_PAGE = 100;

type TokenResponse = { access_token: string; refresh_token: string; expires_at: number; athlete?: { id: number } };

export function createStravaClient({ clientId, clientSecret }: { clientId: string; clientSecret: string }): ActivitySource {
  async function call<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (res.status === 401) throw new IntegrationError('Strava access was revoked or expired. Please reconnect.', 401, 'unauthorized');
    if (res.status === 429) throw new IntegrationError('Strava rate limit reached. Try again in 15 minutes.', 429, 'rate_limited');
    if (!res.ok) throw new IntegrationError(`Strava request failed (${res.status})`, res.status, 'upstream');
    return (await res.json()) as T;
  }

  const tokens = (t: TokenResponse, scope?: string): OAuthTokens => ({
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: new Date(t.expires_at * 1000),
    scope,
    externalUserId: t.athlete ? String(t.athlete.id) : undefined,
  });

  const tokenRequest = (params: Record<string, string>) =>
    call<TokenResponse>(`${AUTH}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
    });

  return {
    authorizeUrl({ redirectUri, state }) {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        approval_prompt: 'auto',
        scope: 'read,activity:read_all',
        state,
      });
      return `${AUTH}/authorize?${q}`;
    },

    async exchangeCode(code) {
      return tokens(await tokenRequest({ code, grant_type: 'authorization_code' }));
    },

    async refresh(refreshToken) {
      return tokens(await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' }));
    },

    async revoke(accessToken) {
      await call(`${AUTH}/deauthorize`, { method: 'POST', headers: { authorization: `Bearer ${accessToken}` } });
    },

    async listActivities(accessToken, { after, maxPages = 10 }) {
      const out: NormalizedActivity[] = [];
      for (let page = 1; page <= maxPages; page++) {
        const q = new URLSearchParams({ after: String(Math.floor(after.getTime() / 1000)), page: String(page), per_page: String(PER_PAGE) });
        const batch = await call<StravaActivity[]>(`${API}/athlete/activities?${q}`, { headers: { authorization: `Bearer ${accessToken}` } });
        for (const a of batch) {
          const m = mapStravaActivity(a);
          if (m) out.push(m);
        }
        if (batch.length < PER_PAGE) break;
      }
      return out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    },
  };
}
