import {
  IWalletRepository,
  Wallet,
  WalletStatus,
} from '@amirhossein-moloki/wallet-core';
import { RepositoryNotFoundError } from '@amirhossein-moloki/payment-core';
import { PgExecutor } from '../migrator.js';
import { mapWalletPgError } from '../error-mapper.js';

export class PostgresWalletRepository implements IWalletRepository {
  constructor(private readonly executor: PgExecutor) {}

  public async findById(id: string): Promise<Wallet | null> {
    try {
      const sql = `SELECT * FROM wallets WHERE id = $1`;
      const res = await this.executor.query(sql, [id]);

      if (res.rows.length === 0) {
        return null;
      }

      return this.mapRowToWallet(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapWalletPgError(err, `Failed to find wallet by id '${id}'`);
    }
  }

  public async findByOwnerId(ownerId: string): Promise<Wallet[]> {
    try {
      const sql = `SELECT * FROM wallets WHERE owner_id = $1 ORDER BY created_at DESC`;
      const res = await this.executor.query(sql, [ownerId]);

      return res.rows.map((row) => this.mapRowToWallet(row as Record<string, unknown>));
    } catch (err) {
      throw mapWalletPgError(err, `Failed to find wallets for ownerId '${ownerId}'`);
    }
  }

  public async save(wallet: Wallet): Promise<Wallet> {
    try {
      const sql = `
        INSERT INTO wallets (
          id, owner_id, currency, status, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;
      const values = [
        wallet.id,
        wallet.ownerId,
        wallet.currency,
        wallet.status,
        JSON.stringify(wallet.metadata || {}),
        wallet.createdAt,
        wallet.updatedAt,
      ];

      const res = await this.executor.query(sql, values);
      return this.mapRowToWallet(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapWalletPgError(err, `Failed to save wallet '${wallet.id}'`);
    }
  }

  public async updateStatus(id: string, status: WalletStatus): Promise<void> {
    try {
      const sql = `UPDATE wallets SET status = $1, updated_at = NOW() WHERE id = $2`;
      const res = await this.executor.query(sql, [status, id]);

      if (((res as unknown as { rowCount?: number }).rowCount ?? res.rows.length) === 0) {
        throw new RepositoryNotFoundError('Wallet', id);
      }
    } catch (err) {
      if (err instanceof RepositoryNotFoundError) {
        throw err;
      }
      throw mapWalletPgError(err, `Failed to update status for wallet '${id}'`);
    }
  }

  private mapRowToWallet(row: Record<string, unknown>): Wallet {
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

    return new Wallet({
      id: row.id as string,
      ownerId: row.owner_id as string,
      currency: row.currency as string,
      status: row.status as WalletStatus,
      metadata,
      createdAt: new Date(row.created_at as string | Date),
      updatedAt: new Date(row.updated_at as string | Date),
    });
  }
}
