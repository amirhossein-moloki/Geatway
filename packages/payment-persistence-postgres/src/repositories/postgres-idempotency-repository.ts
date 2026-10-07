import {
  IdempotencyRecord,
  IdempotencyRepository,
  IdempotencyStatus,
  IdempotencyStore,
  PersistenceConflictError,
  RepositoryNotFoundError,
} from '@amirhossein-moloki/payment-core';
import { PgExecutor } from '../migrator.js';
import { mapPgError } from '../error-mapper.js';

export class PostgresIdempotencyRepository implements IdempotencyRepository, IdempotencyStore {
  constructor(private readonly executor: PgExecutor) {}

  public async save(record: IdempotencyRecord): Promise<IdempotencyRecord> {
    try {
      const sql = `
        INSERT INTO idempotency_records (
          id, scope, key, request_hash, status, result, created_at, updated_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const values = [
        record.id,
        record.scope,
        record.key,
        record.requestHash,
        record.status,
        record.result ? JSON.stringify(record.result) : null,
        record.createdAt,
        record.updatedAt,
        record.expiresAt ?? null,
      ];

      const res = await this.executor.query(sql, values);
      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      const mappedErr = mapPgError(
        err,
        `Failed to save idempotency record for scope '${record.scope}' key '${record.key}'`,
      );
      if (mappedErr instanceof PersistenceConflictError) {
        const existing = await this.findByScopeAndKey(record.scope, record.key);
        if (existing) {
          if (existing.requestHash !== record.requestHash) {
            throw new PersistenceConflictError(
              `Idempotency key conflict: key '${record.key}' in scope '${record.scope}' was previously called with a different request payload`,
              {
                scope: record.scope,
                key: record.key,
                storedHash: existing.requestHash,
                newHash: record.requestHash,
              },
            );
          }
          return existing;
        }
      }
      throw mappedErr;
    }
  }

  public async findByScopeAndKey(scope: string, key: string): Promise<IdempotencyRecord | null> {
    try {
      const now = new Date();
      const sql = `
        SELECT * FROM idempotency_records
        WHERE scope = $1 AND key = $2
        AND (expires_at IS NULL OR expires_at > $3)
      `;
      const res = await this.executor.query(sql, [scope, key, now]);

      if (res.rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapPgError(err, `Failed to find idempotency record scope=${scope} key=${key}`);
    }
  }

  public async update(record: IdempotencyRecord): Promise<IdempotencyRecord> {
    try {
      const updatedAt = new Date();
      const sql = `
        UPDATE idempotency_records SET
          status = $1,
          result = $2,
          updated_at = $3,
          expires_at = $4
        WHERE id = $5
        RETURNING *
      `;
      const values = [
        record.status,
        record.result ? JSON.stringify(record.result) : null,
        updatedAt,
        record.expiresAt ?? null,
        record.id,
      ];

      const res = await this.executor.query(sql, values);
      if (res.rows.length === 0) {
        throw new RepositoryNotFoundError('IdempotencyRecord', record.id);
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (err instanceof RepositoryNotFoundError) {
        throw err;
      }
      throw mapPgError(err, `Failed to update idempotency record ${record.id}`);
    }
  }

  public async delete(keyOrScope: string, key?: string): Promise<boolean> {
    try {
      const actualScope = key !== undefined ? keyOrScope : 'default';
      const actualKey = key !== undefined ? key : keyOrScope;

      const sql = `DELETE FROM idempotency_records WHERE scope = $1 AND key = $2`;
      const res = await this.executor.query(sql, [actualScope, actualKey]);
      return ((res as unknown as { rowCount?: number }).rowCount ?? res.rows.length) > 0;
    } catch (err) {
      throw mapPgError(err, `Failed to delete idempotency record key=${keyOrScope}`);
    }
  }

  // --- IdempotencyStore compatibility methods ---

  public async get<T = unknown>(key: string): Promise<T | null> {
    const record = await this.findByScopeAndKey('default', key);
    if (!record) {
      return null;
    }
    return record.result as T;
  }

  public async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
    const existing = await this.findByScopeAndKey('default', key);

    if (existing) {
      const updated = new IdempotencyRecord({
        id: existing.id,
        scope: existing.scope,
        key: existing.key,
        requestHash: existing.requestHash,
        status: IdempotencyStatus.COMPLETED,
        result: value,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
        expiresAt,
      });
      await this.update(updated);
    } else {
      const newRecord = new IdempotencyRecord({
        scope: 'default',
        key,
        requestHash: 'store-compat',
        status: IdempotencyStatus.COMPLETED,
        result: value,
        expiresAt,
      });
      await this.save(newRecord);
    }
  }

  public async has(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  private mapRowToEntity(row: Record<string, unknown>): IdempotencyRecord {
    const rawResult = row.result;
    let result: Record<string, unknown> | unknown = undefined;
    if (typeof rawResult === 'string') {
      try {
        result = JSON.parse(rawResult);
      } catch {
        result = rawResult;
      }
    } else if (rawResult !== null && rawResult !== undefined) {
      result = rawResult;
    }

    return new IdempotencyRecord({
      id: row.id as string,
      scope: row.scope as string,
      key: row.key as string,
      requestHash: row.request_hash as string,
      status: row.status as IdempotencyStatus,
      result,
      createdAt: new Date(row.created_at as string | Date),
      updatedAt: new Date(row.updated_at as string | Date),
      expiresAt: row.expires_at ? new Date(row.expires_at as string | Date) : null,
    });
  }
}
