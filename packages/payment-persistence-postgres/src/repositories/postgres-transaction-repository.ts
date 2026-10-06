import {
  Transaction,
  TransactionRepository,
  TransactionStatus,
  TransactionType,
  RepositoryNotFoundError,
} from '@company/payment-core';
import { PgExecutor } from '../migrator.js';
import { mapPgError } from '../error-mapper.js';

export class PostgresTransactionRepository implements TransactionRepository {
  constructor(private readonly executor: PgExecutor) {}

  public async create(transaction: Transaction): Promise<Transaction> {
    try {
      const sql = `
        INSERT INTO transactions (
          id, payment_id, gateway, type, status, amount, reference,
          gateway_transaction_id, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      const values = [
        transaction.id,
        transaction.paymentId,
        transaction.gateway,
        transaction.type,
        transaction.status,
        transaction.amount,
        transaction.reference ?? null,
        transaction.gatewayTransactionId ?? null,
        JSON.stringify(transaction.metadata || {}),
        transaction.createdAt,
        transaction.updatedAt,
      ];

      const res = await this.executor.query(sql, values);
      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapPgError(err, 'Failed to create transaction');
    }
  }

  public async findById(id: string): Promise<Transaction | null> {
    try {
      const sql = `SELECT * FROM transactions WHERE id = $1`;
      const res = await this.executor.query(sql, [id]);

      if (res.rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapPgError(err, `Failed to find transaction by id ${id}`);
    }
  }

  public async findByPaymentId(paymentId: string): Promise<Transaction[]> {
    try {
      const sql = `SELECT * FROM transactions WHERE payment_id = $1 ORDER BY created_at ASC`;
      const res = await this.executor.query(sql, [paymentId]);

      return res.rows.map((row: Record<string, unknown>) => this.mapRowToEntity(row));
    } catch (err) {
      throw mapPgError(err, `Failed to find transactions for payment ${paymentId}`);
    }
  }

  public async findByProviderReference(
    gateway: string,
    reference: string,
  ): Promise<Transaction | null> {
    try {
      const sql = `
        SELECT * FROM transactions
        WHERE gateway = $1 AND (reference = $2 OR gateway_transaction_id = $2)
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const res = await this.executor.query(sql, [gateway, reference]);

      if (res.rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapPgError(err, `Failed to find transaction by provider reference ${reference}`);
    }
  }

  public async findByType(paymentId: string, type: TransactionType): Promise<Transaction[]> {
    try {
      const sql = `
        SELECT * FROM transactions
        WHERE payment_id = $1 AND type = $2
        ORDER BY created_at ASC
      `;
      const res = await this.executor.query(sql, [paymentId, type]);

      return res.rows.map((row: Record<string, unknown>) => this.mapRowToEntity(row));
    } catch (err) {
      throw mapPgError(err, `Failed to find transactions by type ${type} for payment ${paymentId}`);
    }
  }

  public async update(transaction: Transaction): Promise<Transaction> {
    try {
      const updatedAt = new Date();
      const sql = `
        UPDATE transactions SET
          status = $1,
          amount = $2,
          reference = $3,
          gateway_transaction_id = $4,
          metadata = $5,
          updated_at = $6
        WHERE id = $7
        RETURNING *
      `;
      const values = [
        transaction.status,
        transaction.amount,
        transaction.reference ?? null,
        transaction.gatewayTransactionId ?? null,
        JSON.stringify(transaction.metadata || {}),
        updatedAt,
        transaction.id,
      ];

      const res = await this.executor.query(sql, values);
      if (res.rows.length === 0) {
        throw new RepositoryNotFoundError('Transaction', transaction.id);
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (err instanceof RepositoryNotFoundError) {
        throw err;
      }
      throw mapPgError(err, `Failed to update transaction ${transaction.id}`);
    }
  }

  private mapRowToEntity(row: Record<string, unknown>): Transaction {
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

    return new Transaction({
      id: row.id as string,
      paymentId: row.payment_id as string,
      gateway: row.gateway as string,
      type: row.type as TransactionType,
      status: row.status as TransactionStatus,
      amount: Number(row.amount),
      reference: (row.reference as string) || undefined,
      gatewayTransactionId: (row.gateway_transaction_id as string) || undefined,
      metadata,
      createdAt: new Date(row.created_at as string | Date),
      updatedAt: new Date(row.updated_at as string | Date),
    });
  }
}
