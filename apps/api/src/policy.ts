import { and, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from './db/client';
import { athleteAccess } from './db/schema';

export type Role = 'owner' | 'coach' | 'viewer';
export type Action = 'read' | 'write' | 'share';

const ALLOWED: Record<Role, Action[]> = {
  owner: ['read', 'write', 'share'],
  coach: ['read', 'write'],
  viewer: ['read'],
};

export async function roleFor(userId: string, athleteId: string): Promise<Role | null> {
  const [row] = await db
    .select({ role: athleteAccess.role })
    .from(athleteAccess)
    .where(and(eq(athleteAccess.userId, userId), eq(athleteAccess.athleteId, athleteId)));
  return row?.role ?? null;
}

/** The single place where athlete-level permissions are decided. Throws 404 to avoid leaking existence. */
export async function requireAthlete(userId: string, athleteId: string, action: Action): Promise<Role> {
  const role = await roleFor(userId, athleteId);
  if (!role) throw new HTTPException(404, { message: 'Athlete not found' });
  if (!ALLOWED[role].includes(action)) throw new HTTPException(403, { message: 'Not allowed' });
  return role;
}
