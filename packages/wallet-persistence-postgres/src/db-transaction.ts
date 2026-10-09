import { PgExecutor } from './migrator.js';

export interface PgClientLike extends PgExecutor {
  release?(err?: boolean | Error): void;
}

export interface PgPoolLike extends PgExecutor {
  connect(): Promise<PgClientLike>;
}

/**
 * Helper to run operations within a PostgreSQL transaction boundary.
 * If the executor is a Pool (has `.connect()`), acquires a dedicated client,
 * issues `BEGIN`, executes the callback, and `COMMIT`s (or `ROLLBACK`s on failure).
 * If the executor is already a Client, executes the callback directly.
 */
export async function withTransaction<T>(
  executor: PgExecutor,
  fn: (client: PgExecutor) => Promise<T>,
): Promise<T> {
  const isPool = typeof (executor as PgPoolLike).connect === 'function';
  if (!isPool) {
    return fn(executor);
  }

  const client: PgClientLike = await (executor as PgPoolLike).connect();
  const shouldRelease = typeof client.release === 'function';

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failure if connection was interrupted
    }
    throw error;
  } finally {
    if (shouldRelease && client.release) {
      client.release();
    }
  }
}
