import postgres from 'postgres';

/** Recreates the test database, then applies migrations and the catalog. */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgres://coach:coach@localhost:5432/training_coach_test');
  const name = url.pathname.slice(1);
  const admin = postgres({ host: url.hostname, port: Number(url.port), user: url.username, password: url.password, database: 'postgres', onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${name}" with (force)`);
  await admin.unsafe(`create database "${name}"`);
  await admin.end();

  process.env.DATABASE_URL = url.toString();
  process.env.BETTER_AUTH_SECRET ??= 'test-secret-test-secret-test-secret-123';
  const { runMigrations } = await import('../src/db/migrate');
  const { seedCatalog } = await import('../src/db/seed');
  const { sql } = await import('../src/db/client');
  await runMigrations();
  await seedCatalog();
  await sql.end();
}
