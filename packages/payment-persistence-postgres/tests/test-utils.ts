import { newDb, DataType } from 'pg-mem';
import { DatabaseMigrator, PgExecutor } from '../src/migrator.js';
import * as path from 'path';

export async function createTestDatabase(): Promise<PgExecutor> {
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
