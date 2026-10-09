import * as fs from 'fs';
import * as path from 'path';

export interface QueryResultLike<R = Record<string, unknown>> {
  rows: R[];
  rowCount?: number | null;
}

export interface PgExecutor {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResultLike<R>>;
}

export class DatabaseMigrator {
  constructor(private readonly executor: PgExecutor) {}

  public async initMigrationsTable(): Promise<void> {
    await this.executor.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  public async runMigration(version: string, sql: string): Promise<boolean> {
    await this.initMigrationsTable();

    const res = await this.executor.query(
      `SELECT version FROM schema_migrations WHERE version = $1`,
      [version],
    );

    if (res.rows.length > 0) {
      return false; // Already applied
    }

    await this.executor.query(sql);
    await this.executor.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version]);

    return true;
  }

  public async runMigrationFiles(migrationsDir: string): Promise<string[]> {
    const applied: string[] = [];
    if (!fs.existsSync(migrationsDir)) {
      return applied;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      const wasApplied = await this.runMigration(file, sql);
      if (wasApplied) {
        applied.push(file);
      }
    }

    return applied;
  }
}
