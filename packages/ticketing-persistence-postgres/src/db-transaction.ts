import { PgExecutor } from './migrator.js';

export async function withTransaction<T>(
  pool: { connect: () => Promise<{ query: PgExecutor['query']; release: () => void }> },
  fn: (client: PgExecutor) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
