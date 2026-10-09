'use client';

import { createApiClient } from '@tc/api/client';
import { createAuthClient } from 'better-auth/react';

const origin = typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin;

// The API app already has basePath /api, so the client base is the bare origin.
export const api = createApiClient(origin).api.v1;
export const authClient = createAuthClient({ baseURL: origin, basePath: '/api/auth' });

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Unwraps a Hono client response: JSON on success, ApiError with the server's message otherwise. */
export async function unwrap<T>(p: Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>): Promise<T> {
  const res = await p;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiError(res.status, body?.error?.message ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
