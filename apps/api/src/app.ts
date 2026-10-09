import { zValidator as zv } from '@hono/zod-validator';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
  createSessionInput,
  deviceProvider,
  sessionsQuery,
  setSportsInput,
  shareAccessInput,
  updateDeviceInput,
  updateProfileInput,
  updateSessionExerciseInput,
  updateSessionInput,
  type MeDto,
} from '@tc/core';
import { auth, type AuthUser } from './auth';
import { db } from './db/client';
import { env } from './env';
import { exercise, sport } from './db/schema';
import { requireAthlete } from './policy';
import {
  getAthlete,
  listAthletesForUser,
  listSuggestions,
  listThresholdHistory,
  setSports,
  shareAthlete,
  updateProfile,
} from './services/athletes';
import { listDevices, updateDevice } from './services/devices';
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  sessionAthleteId,
  setExerciseDone,
  updateSession,
} from './services/sessions';
import { isNull } from 'drizzle-orm';

type Env = { Variables: { user: AuthUser } };

/** Validation errors use the same `{ error: { code, message } }` shape as everything else. */
const validate = <T extends z.ZodType, K extends 'json' | 'query' | 'param'>(target: K, schema: T) =>
  zv(target, schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'invalid_input', message: z.prettifyError(result.error) } }, 400);
    }
  });

const athleteParam = validate('param', z.object({ aid: z.uuid() }));
const sessionParam = validate('param', z.object({ sid: z.uuid() }));

const requireUser: MiddlewareHandler<Env> = async (c, next) => {
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!s) throw new HTTPException(401, { message: 'Not signed in' });
  c.set('user', s.user);
  await next();
};

/** Resolves a session's athlete and checks the user's permission on it. */
async function authorizeSession(c: Context<Env>, sid: string, action: 'read' | 'write') {
  const athleteId = await sessionAthleteId(sid);
  if (!athleteId) throw new HTTPException(404, { message: 'Session not found' });
  await requireAthlete(c.get('user').id, athleteId, action);
}

const v1 = new Hono<Env>()
  .use(requireUser)
  .get('/me', async (c) => {
    const u = c.get('user');
    return c.json({ user: { id: u.id, name: u.name, email: u.email }, athletes: await listAthletesForUser(u.id) } satisfies MeDto);
  })
  .get('/catalog', async (c) => {
    const [sports, exercises] = await Promise.all([
      db.select().from(sport),
      db.select().from(exercise).where(isNull(exercise.ownerId)),
    ]);
    return c.json({ sports, exercises });
  })
  .get('/athletes/:aid', athleteParam, async (c) => {
    const { aid } = c.req.valid('param');
    const role = await requireAthlete(c.get('user').id, aid, 'read');
    return c.json(await getAthlete(aid, role));
  })
  .patch('/athletes/:aid', athleteParam, validate('json', updateProfileInput), async (c) => {
    const { aid } = c.req.valid('param');
    const role = await requireAthlete(c.get('user').id, aid, 'write');
    await updateProfile(aid, c.req.valid('json'));
    return c.json(await getAthlete(aid, role));
  })
  .get('/athletes/:aid/thresholds', athleteParam, async (c) => {
    const { aid } = c.req.valid('param');
    await requireAthlete(c.get('user').id, aid, 'read');
    return c.json(await listThresholdHistory(aid));
  })
  .put('/athletes/:aid/sports', athleteParam, validate('json', setSportsInput), async (c) => {
    const { aid } = c.req.valid('param');
    const role = await requireAthlete(c.get('user').id, aid, 'write');
    await setSports(aid, c.req.valid('json').sports);
    return c.json(await getAthlete(aid, role));
  })
  .post('/athletes/:aid/access', athleteParam, validate('json', shareAccessInput), async (c) => {
    const { aid } = c.req.valid('param');
    await requireAthlete(c.get('user').id, aid, 'share');
    const { email, role } = c.req.valid('json');
    await shareAthlete(aid, email, role);
    return c.json({ ok: true });
  })
  .get('/athletes/:aid/sessions', athleteParam, validate('query', sessionsQuery), async (c) => {
    const { aid } = c.req.valid('param');
    await requireAthlete(c.get('user').id, aid, 'read');
    const { from, to } = c.req.valid('query');
    return c.json(await listSessions(aid, from, to));
  })
  .post('/athletes/:aid/sessions', athleteParam, validate('json', createSessionInput), async (c) => {
    const { aid } = c.req.valid('param');
    await requireAthlete(c.get('user').id, aid, 'write');
    return c.json(await createSession(aid, c.get('user').id, c.req.valid('json')), 201);
  })
  .get('/athletes/:aid/suggestions', athleteParam, async (c) => {
    const { aid } = c.req.valid('param');
    await requireAthlete(c.get('user').id, aid, 'read');
    return c.json(await listSuggestions(aid));
  })
  .get('/athletes/:aid/devices', athleteParam, async (c) => {
    const { aid } = c.req.valid('param');
    await requireAthlete(c.get('user').id, aid, 'read');
    return c.json(await listDevices(aid));
  })
  .put(
    '/athletes/:aid/devices/:provider',
    validate('param', z.object({ aid: z.uuid(), provider: deviceProvider })),
    validate('json', updateDeviceInput),
    async (c) => {
      const { aid, provider } = c.req.valid('param');
      await requireAthlete(c.get('user').id, aid, 'write');
      return c.json(await updateDevice(aid, provider, c.req.valid('json')));
    },
  )
  .get('/sessions/:sid', sessionParam, async (c) => {
    const { sid } = c.req.valid('param');
    await authorizeSession(c, sid, 'read');
    return c.json((await getSession(sid))!);
  })
  .patch('/sessions/:sid', sessionParam, validate('json', updateSessionInput), async (c) => {
    const { sid } = c.req.valid('param');
    await authorizeSession(c, sid, 'write');
    return c.json(await updateSession(sid, c.req.valid('json')));
  })
  .delete('/sessions/:sid', sessionParam, async (c) => {
    const { sid } = c.req.valid('param');
    await authorizeSession(c, sid, 'write');
    await deleteSession(sid);
    return c.body(null, 204);
  })
  .patch(
    '/sessions/:sid/exercises/:rowId',
    validate('param', z.object({ sid: z.uuid(), rowId: z.uuid() })),
    validate('json', updateSessionExerciseInput),
    async (c) => {
      const { sid, rowId } = c.req.valid('param');
      await authorizeSession(c, sid, 'write');
      return c.json(await setExerciseDone(sid, rowId, c.req.valid('json').done));
    },
  );

export const app = new Hono()
  .basePath('/api')
  // Request log without bodies or query strings: never log health data.
  .use(async (c, next) => {
    const t = performance.now();
    await next();
    if (env.NODE_ENV !== 'test') console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${Math.round(performance.now() - t)}ms`);
  })
  .get('/health', (c) => c.json({ ok: true }))
  .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
  .route('/v1', v1);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: { code: String(err.status), message: err.message } }, err.status);
  }
  console.error(err);
  return c.json({ error: { code: 'internal', message: 'Something went wrong' } }, 500);
});

export type AppType = typeof app;
