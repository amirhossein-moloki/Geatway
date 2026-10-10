import { newDb, DataType } from 'pg-mem';
import { DatabaseMigrator, PgExecutor } from '../src/migrator.js';
import * as path from 'path';
import pg from 'pg';

export async function createTestDatabase(): Promise<PgExecutor> {
  const dbUrl = process.env.TEST_DATABASE_URL;
  if (dbUrl) {
    const pool = new pg.Pool({ connectionString: dbUrl });
    const migrator = new DatabaseMigrator(pool as unknown as PgExecutor);
    const migrationsDir = path.join(__dirname, '../migrations');
    await migrator.runMigrationFiles(migrationsDir);
    return pool as unknown as PgExecutor;
  }

  const db = newDb();

  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 15.0 (pg-mem)',
  });

  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();

  const migrator = new DatabaseMigrator(pool as unknown as PgExecutor);
  const migrationsDir = path.join(__dirname, '../migrations');
  await migrator.runMigrationFiles(migrationsDir);

  return pool as unknown as PgExecutor;
}
