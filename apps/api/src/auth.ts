import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { db } from './db/client';
import * as schema from './db/schema';
import { env } from './env';
import { createOwnAthlete } from './services/athletes';

const allowedEmails = env.SIGNUP_ALLOWED_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];

export const auth = betterAuth({
  baseURL: env.APP_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 10, autoSignIn: true },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  advanced: { useSecureCookies: env.APP_URL.startsWith('https://') },
  databaseHooks: {
    user: {
      create: {
        // Private household instance: only invited emails may register (if configured).
        before: async (u) => {
          if (allowedEmails.length && !allowedEmails.includes(u.email.toLowerCase())) {
            throw new APIError('FORBIDDEN', { message: 'Sign-up is invite-only on this server.' });
          }
        },
        // Every user starts with their own athlete profile.
        after: async (u) => {
          await createOwnAthlete(u.id, u.name);
        },
      },
    },
  },
});

export type AuthUser = typeof auth.$Infer.Session.user;
