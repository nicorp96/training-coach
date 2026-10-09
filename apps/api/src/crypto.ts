// Encryption for integration tokens at rest, and signed OAuth `state` values.
// Keys are derived from BETTER_AUTH_SECRET, so there is no extra secret to manage.
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

const key = (purpose: string) => Buffer.from(hkdfSync('sha256', env.BETTER_AUTH_SECRET, 'tempo', purpose, 32));
const TOKEN_KEY = key('integration-tokens');
const STATE_KEY = key('oauth-state');

/** AES-256-GCM. Output: base64url(iv | tag | ciphertext). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', TOKEN_KEY, iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}

export function decrypt(enc: string): string {
  const buf = Buffer.from(enc, 'base64url');
  const d = createDecipheriv('aes-256-gcm', TOKEN_KEY, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}

const sign = (payload: string) => createHmac('sha256', STATE_KEY).update(payload).digest('base64url');

/** Short-lived signed value that ties an OAuth callback to the user and athlete that started it. */
export function signState(data: Record<string, string>, ttlSec = 600): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyState(state: string): Record<string, string> | null {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, string> & { exp: number };
  if (data.exp < Date.now() / 1000) return null;
  return data;
}
