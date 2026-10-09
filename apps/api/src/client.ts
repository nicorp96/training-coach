// Typed RPC client for web and (later) mobile. Import types only from this package.
import { hc } from 'hono/client';
import type { AppType } from './app';

export type { AppType };
export const createApiClient = (baseUrl: string, init?: RequestInit) =>
  hc<AppType>(baseUrl, { init: { credentials: 'include', ...init } });
