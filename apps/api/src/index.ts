import { serve } from '@hono/node-server';
import { app } from './app';
import { env } from './env';
import { runMigrations } from './db/migrate';
import { seedCatalog } from './db/seed';

await runMigrations();
await seedCatalog();
serve({ fetch: app.fetch, port: env.API_PORT }, (info) => console.log(`API listening on http://localhost:${info.port}`));
