import { describe, it, expect, beforeEach } from 'vitest';
import { newDb, DataType } from 'pg-mem';
import { DatabaseMigrator, PgExecutor } from '../src/migrator.js';
import * as path from 'path';

describe('Database Migrator Readiness Suite', () => {
  let pool: PgExecutor;
  let migrator: DatabaseMigrator;
  let migrationsDir: string;

  beforeEach(() => {
    const db = newDb();

    db.public.registerFunction({
      name: 'version',
      returns: DataType.text,
      implementation: () => 'PostgreSQL 15.0 (pg-mem)',
    });

    const adapter = db.adapters.createPg();
    pool = new adapter.Pool() as unknown as PgExecutor;
    migrator = new DatabaseMigrator(pool);
    migrationsDir = path.join(__dirname, '../migrations');
  });

  it('successfully applies initial wallet schema migrations and creates schema_migrations tracking table', async () => {
    const applied = await migrator.runMigrationFiles(migrationsDir);
    expect(applied).toContain('001_wallet_initial_schema.sql');

    // Verify schema_migrations table exists and contains record
    const migRes = await pool.query('SELECT version FROM schema_migrations');
    expect(migRes.rows.length).toBeGreaterThanOrEqual(1);
    expect(migRes.rows[0].version).toBe('001_wallet_initial_schema.sql');

    // Verify wallets table exists and is operational
    const walletRes = await pool.query('SELECT COUNT(*) as cnt FROM wallets');
    expect(Number(walletRes.rows[0].cnt)).toBe(0);

    // Verify ledger_accounts table exists
    const accountRes = await pool.query('SELECT COUNT(*) as cnt FROM ledger_accounts');
    expect(Number(accountRes.rows[0].cnt)).toBe(0);

    // Verify ledger_transactions table exists
    const txRes = await pool.query('SELECT COUNT(*) as cnt FROM ledger_transactions');
    expect(Number(txRes.rows[0].cnt)).toBe(0);

    // Verify ledger_entries table exists
    const entryRes = await pool.query('SELECT COUNT(*) as cnt FROM ledger_entries');
    expect(Number(entryRes.rows[0].cnt)).toBe(0);
  });

  it('guarantees idempotent duplicate migration execution without error', async () => {
    // First run
    const appliedFirst = await migrator.runMigrationFiles(migrationsDir);
    expect(appliedFirst.length).toBeGreaterThan(0);

    // Second run (should detect migrations already applied and skip)
    const appliedSecond = await migrator.runMigrationFiles(migrationsDir);
    expect(appliedSecond).toEqual([]);

    // Check that schema remains intact
    const walletRes = await pool.query('SELECT COUNT(*) as cnt FROM wallets');
    expect(Number(walletRes.rows[0].cnt)).toBe(0);
  });
});
