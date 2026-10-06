import {
  Payment,
  PaymentFilter,
  PaymentRepository,
  PaymentStatus,
  ConcurrencyError,
  RepositoryNotFoundError,
} from '@company/payment-core';
import { PgExecutor } from '../migrator.js';
import { mapPgError } from '../error-mapper.js';

export class PostgresPaymentRepository implements PaymentRepository {
  constructor(private readonly executor: PgExecutor) {}

  public async create(payment: Payment): Promise<Payment> {
    try {
      const sql = `
        INSERT INTO payments (
          id, project_id, amount, currency, description, callback_url,
          gateway, status, metadata, idempotency_key, version, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      const values = [
        payment.id,
        payment.projectId ?? null,
        payment.amount,
        payment.currency,
        payment.description ?? null,
        payment.callbackUrl ?? null,
        payment.gateway ?? null,
        payment.status,
        JSON.stringify(payment.metadata || {}),
        payment.idempotencyKey ?? null,
        payment.version,
        payment.createdAt,
        payment.updatedAt,
      ];

      const res = await this.executor.query(sql, values);
      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapPgError(err, 'Failed to create payment');
    }
  }

  public async findById(id: string): Promise<Payment | null> {
    try {
      const sql = `SELECT * FROM payments WHERE id = $1`;
      const res = await this.executor.query(sql, [id]);

      if (res.rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapPgError(err, `Failed to find payment by id ${id}`);
    }
  }

  public async findByExternalId(externalId: string): Promise<Payment | null> {
    try {
      const sql = `
        SELECT * FROM payments
        WHERE idempotency_key = $1
        OR id IN (
          SELECT payment_id FROM transactions
          WHERE reference = $1 OR gateway_transaction_id = $1
        )
        LIMIT 1
      `;
      const res = await this.executor.query(sql, [externalId]);

      if (res.rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapPgError(err, `Failed to find payment by external id ${externalId}`);
    }
  }

  public async update(payment: Payment, expectedVersion?: number): Promise<Payment> {
    try {
      const targetExpectedVersion =
        expectedVersion !== undefined ? expectedVersion : payment.version;
      const nextVersion = targetExpectedVersion + 1;
      const updatedAt = new Date();

      const sql = `
        UPDATE payments SET
          status = $1,
          amount = $2,
          currency = $3,
          description = $4,
          callback_url = $5,
          gateway = $6,
          metadata = $7,
          idempotency_key = $8,
          version = $9,
          updated_at = $10
        WHERE id = $11 AND version = $12
        RETURNING *
      `;

      const values = [
        payment.status,
        payment.amount,
        payment.currency,
        payment.description ?? null,
        payment.callbackUrl ?? null,
        payment.gateway ?? null,
        JSON.stringify(payment.metadata || {}),
        payment.idempotencyKey ?? null,
        nextVersion,
        updatedAt,
        payment.id,
        targetExpectedVersion,
      ];

      const res = await this.executor.query(sql, values);

      if (res.rows.length === 0) {
        const checkRes = await this.executor.query(`SELECT version FROM payments WHERE id = $1`, [
          payment.id,
        ]);
        if (checkRes.rows.length === 0) {
          throw new RepositoryNotFoundError('Payment', payment.id);
        }
        throw new ConcurrencyError(
          `Payment update failed for id '${payment.id}': expected version ${targetExpectedVersion}, but stored version differs`,
          { paymentId: payment.id, expectedVersion: targetExpectedVersion },
        );
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (err instanceof ConcurrencyError || err instanceof RepositoryNotFoundError) {
        throw err;
      }
      throw mapPgError(err, `Failed to update payment ${payment.id}`);
    }
  }

  public async list(filter?: PaymentFilter): Promise<Payment[]> {
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (filter?.status) {
        conditions.push(`status = $${idx++}`);
        values.push(filter.status);
      }
      if (filter?.gateway) {
        conditions.push(`gateway = $${idx++}`);
        values.push(filter.gateway);
      }
      if (filter?.projectId) {
        conditions.push(`project_id = $${idx++}`);
        values.push(filter.projectId);
      }

      let sql = `SELECT * FROM payments`;
      if (conditions.length > 0) {
        sql += ` WHERE ` + conditions.join(' AND ');
      }

      sql += ` ORDER BY created_at DESC`;

      if (filter?.limit) {
        sql += ` LIMIT $${idx++}`;
        values.push(filter.limit);
      }
      if (filter?.offset) {
        sql += ` OFFSET $${idx++}`;
        values.push(filter.offset);
      }

      const res = await this.executor.query(sql, values);
      return res.rows.map((row: Record<string, unknown>) => this.mapRowToEntity(row));
    } catch (err) {
      throw mapPgError(err, 'Failed to list payments');
    }
  }

  private mapRowToEntity(row: Record<string, unknown>): Payment {
    const rawMetadata = row.metadata;
    let metadata: Record<string, unknown> = {};
    if (typeof rawMetadata === 'string') {
      try {
        metadata = JSON.parse(rawMetadata);
      } catch {
        metadata = {};
      }
    } else if (rawMetadata && typeof rawMetadata === 'object') {
      metadata = rawMetadata as Record<string, unknown>;
    }

    return new Payment({
      id: row.id as string,
      projectId: (row.project_id as string) || undefined,
      amount: Number(row.amount),
      currency: row.currency as string,
      description: (row.description as string) || undefined,
      callbackUrl: (row.callback_url as string) || undefined,
      gateway: (row.gateway as string) || undefined,
      status: row.status as PaymentStatus,
      metadata,
      idempotencyKey: (row.idempotency_key as string) || undefined,
      version: Number(row.version),
      createdAt: new Date(row.created_at as string | Date),
      updatedAt: new Date(row.updated_at as string | Date),
    });
  }
}
