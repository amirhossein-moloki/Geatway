import {
  AccountStatus,
  AccountType,
  CurrencyMismatchError,
  EntryDirection,
  ILedgerRepository,
  ImmutableTransactionError,
  InvalidWalletStateError,
  LedgerAccount,
  LedgerEntry,
  LedgerTransaction,
  Money,
  TransactionStatus,
} from '@amirhossein-moloki/wallet-core';
import {
  PersistenceConflictError,
  RepositoryNotFoundError,
} from '@amirhossein-moloki/payment-core';
import { PgExecutor } from '../migrator.js';
import { mapWalletPgError } from '../error-mapper.js';
import { withTransaction } from '../db-transaction.js';

/**
 * PostgreSQL Implementation of the Wallet Domain `ILedgerRepository`.
 *
 * ### Enforcement Strategy & Integrity Guarantees
 *
 * **PostgreSQL Database-Enforced Invariants:**
 * - Entity identity & uniqueness: Primary keys on `wallets(id)`, `ledger_accounts(id)`, `ledger_transactions(id)`, `ledger_entries(id)`.
 * - Durable Idempotency: `uk_ledger_transactions_idempotency_key` partial unique index on `ledger_transactions(idempotency_key)`.
 * - Referencing Integrity: Foreign keys `ledger_entries.transaction_id -> ledger_transactions.id` and `ledger_entries.account_id -> ledger_accounts.id`.
 * - Amount and Direction Domain Bounds: SQL `CHECK (amount > 0)` and `CHECK (direction IN ('DEBIT', 'CREDIT'))`.
 * - Account Type & Status Bounds: SQL `CHECK (type IN (...))` and `CHECK (status IN (...))`.
 *
 * **Controlled Repository Posting Path Invariants:**
 * - Double-Entry Balancing: Enforces `sum(DEBIT) == sum(CREDIT)` for a transaction in the exact currency (`transaction.validate()`).
 * - Account Existence & Active Status: Verifies all referenced accounts exist and have status `ACTIVE`.
 * - Currency Consistency: Verifies transaction entries match account currencies.
 * - Concurrency Control: Locks referenced `ledger_accounts` using `SELECT ... FOR UPDATE` in deterministic alphabetical `ORDER BY id ASC`.
 * - Exact Monetary Math: Performs BigInt minor-unit arithmetic directly on PostgreSQL `BIGINT` balances.
 * - Atomic Persistence & Rollback: Executes all header, entry, and balance mutations inside a single PostgreSQL database transaction.
 *
 * **Boundary between Persistence and Service-Level Idempotency:**
 * - Persistence Layer: Prevents duplicate ledger transactions at the PostgreSQL database level via unique constraints and transaction locks, ensuring financial operations execute at most once and rejecting payload mismatches.
 * - Service Layer: Manages HTTP header parsing, request validation, response caching, and client retry handling.
 */
export class PostgresLedgerRepository implements ILedgerRepository {
  constructor(private readonly executor: PgExecutor) {}

  public async findAccountById(id: string): Promise<LedgerAccount | null> {
    try {
      const sql = `SELECT * FROM ledger_accounts WHERE id = $1`;
      const res = await this.executor.query(sql, [id]);

      if (res.rows.length === 0) {
        return null;
      }

      return this.mapRowToAccount(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapWalletPgError(err, `Failed to find ledger account by id '${id}'`);
    }
  }

  public async findAccountByWalletIdAndType(
    walletId: string,
    type: AccountType,
  ): Promise<LedgerAccount | null> {
    try {
      const sql = `SELECT * FROM ledger_accounts WHERE wallet_id = $1 AND type = $2 LIMIT 1`;
      const res = await this.executor.query(sql, [walletId, type]);

      if (res.rows.length === 0) {
        return null;
      }

      return this.mapRowToAccount(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapWalletPgError(
        err,
        `Failed to find ledger account for walletId '${walletId}' and type '${type}'`,
      );
    }
  }

  public async findAccountsByWalletId(walletId: string): Promise<LedgerAccount[]> {
    try {
      const sql = `SELECT * FROM ledger_accounts WHERE wallet_id = $1 ORDER BY created_at ASC`;
      const res = await this.executor.query(sql, [walletId]);

      return res.rows.map((row) => this.mapRowToAccount(row as Record<string, unknown>));
    } catch (err) {
      throw mapWalletPgError(err, `Failed to find ledger accounts for walletId '${walletId}'`);
    }
  }

  public async saveAccount(account: LedgerAccount): Promise<LedgerAccount> {
    try {
      const sql = `
        INSERT INTO ledger_accounts (
          id, name, type, currency, wallet_id, status, balance, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;
      const values = [
        account.id,
        account.name,
        account.type,
        account.currency,
        account.walletId ?? null,
        account.status,
        0n, // Initial balance defaults to 0
        JSON.stringify(account.metadata || {}),
        account.createdAt,
        account.createdAt,
      ];

      const res = await this.executor.query(sql, values);
      return this.mapRowToAccount(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapWalletPgError(err, `Failed to save ledger account '${account.id}'`);
    }
  }

  public async getAccountBalance(accountId: string): Promise<Money> {
    try {
      const sql = `SELECT balance, currency FROM ledger_accounts WHERE id = $1`;
      const res = await this.executor.query(sql, [accountId]);

      if (res.rows.length === 0) {
        throw new RepositoryNotFoundError('LedgerAccount', accountId);
      }

      const row = res.rows[0] as { balance: string | bigint | number; currency: string };
      const balanceStr =
        typeof row.balance === 'bigint' ? row.balance.toString() : String(row.balance);
      return Money.fromMinor(balanceStr, row.currency);
    } catch (err) {
      if (err instanceof RepositoryNotFoundError) {
        throw err;
      }
      throw mapWalletPgError(err, `Failed to get balance for account '${accountId}'`);
    }
  }

  public async getTransactionById(id: string): Promise<LedgerTransaction | null> {
    try {
      const txSql = `SELECT * FROM ledger_transactions WHERE id = $1`;
      const txRes = await this.executor.query(txSql, [id]);

      if (txRes.rows.length === 0) {
        return null;
      }

      const entriesSql = `SELECT * FROM ledger_entries WHERE transaction_id = $1 ORDER BY created_at ASC, id ASC`;
      const entriesRes = await this.executor.query(entriesSql, [id]);

      const entries = entriesRes.rows.map((row) =>
        this.mapRowToEntry(row as Record<string, unknown>),
      );

      return this.mapRowToTransaction(txRes.rows[0] as Record<string, unknown>, entries);
    } catch (err) {
      throw mapWalletPgError(err, `Failed to find ledger transaction by id '${id}'`);
    }
  }

  public async getTransactionByIdempotencyKey(key: string): Promise<LedgerTransaction | null> {
    try {
      const txSql = `SELECT * FROM ledger_transactions WHERE idempotency_key = $1 LIMIT 1`;
      const txRes = await this.executor.query(txSql, [key]);

      if (txRes.rows.length === 0) {
        return null;
      }

      const txRow = txRes.rows[0] as Record<string, unknown>;
      const entriesSql = `SELECT * FROM ledger_entries WHERE transaction_id = $1 ORDER BY created_at ASC, id ASC`;
      const entriesRes = await this.executor.query(entriesSql, [txRow.id]);

      const entries = entriesRes.rows.map((row) =>
        this.mapRowToEntry(row as Record<string, unknown>),
      );

      return this.mapRowToTransaction(txRow, entries);
    } catch (err) {
      throw mapWalletPgError(err, `Failed to find ledger transaction by idempotency key '${key}'`);
    }
  }

  public async saveTransaction(transaction: LedgerTransaction): Promise<LedgerTransaction> {
    try {
      return await withTransaction(this.executor, async (txClient) => {
        // 1. Check existing transaction by ID with row lock
        const existingTxRes = await txClient.query(
          `SELECT * FROM ledger_transactions WHERE id = $1 FOR UPDATE`,
          [transaction.id],
        );

        if (existingTxRes.rows.length > 0) {
          const existingRow = existingTxRes.rows[0] as Record<string, unknown>;
          if (existingRow.status === TransactionStatus.POSTED) {
            const entriesRes = await txClient.query(
              `SELECT * FROM ledger_entries WHERE transaction_id = $1 ORDER BY created_at ASC, id ASC`,
              [transaction.id],
            );
            if (entriesRes.rows.length >= 2) {
              const existingEntries = entriesRes.rows.map((r) =>
                this.mapRowToEntry(r as Record<string, unknown>),
              );
              const existingTx = this.mapRowToTransaction(existingRow, existingEntries);

              if (transaction.status === TransactionStatus.POSTED) {
                if (this.areTransactionsEqual(existingTx, transaction)) {
                  return existingTx;
                }
              }
              throw new ImmutableTransactionError(transaction.id);
            }
          }
        }

        // 2. Check Idempotency Key with row lock
        if (transaction.idempotencyKey) {
          const idempRes = await txClient.query(
            `SELECT * FROM ledger_transactions WHERE idempotency_key = $1 FOR UPDATE`,
            [transaction.idempotencyKey],
          );

          if (idempRes.rows.length > 0) {
            const existingRow = idempRes.rows[0] as Record<string, unknown>;
            const entriesRes = await txClient.query(
              `SELECT * FROM ledger_entries WHERE transaction_id = $1 ORDER BY created_at ASC, id ASC`,
              [existingRow.id],
            );
            if (entriesRes.rows.length >= 2) {
              const existingEntries = entriesRes.rows.map((r) =>
                this.mapRowToEntry(r as Record<string, unknown>),
              );
              const existingTx = this.mapRowToTransaction(existingRow, existingEntries);

              if (this.areTransactionsPayloadEqual(existingTx, transaction)) {
                return existingTx;
              } else {
                throw new PersistenceConflictError(
                  `Idempotency key conflict: key '${transaction.idempotencyKey}' was previously used with different transaction payload`,
                  { idempotencyKey: transaction.idempotencyKey },
                );
              }
            }
          }
        }

        // 3. Handle POSTED Status Saving (Atomic Posting & Deterministic Account Locking)
        if (transaction.status === TransactionStatus.POSTED) {
          // Domain Validation (Debits == Credits, non-empty, etc.)
          transaction.validate();

          // Collect and sort unique account IDs alphabetically for deterministic lock order
          const accountIds = Array.from(
            new Set(transaction.entries.map((entry) => entry.accountId)),
          ).sort();

          if (accountIds.length === 0) {
            throw new Error('Transaction has no entry account IDs');
          }

          // Lock accounts using SELECT ... FOR UPDATE in deterministic sorted order
          const placeholders = accountIds.map((_, i) => `$${i + 1}`).join(', ');
          const lockSql = `
            SELECT id, name, type, currency, status, balance
            FROM ledger_accounts
            WHERE id IN (${placeholders})
            ORDER BY id ASC
            FOR UPDATE
          `;
          const lockRes = await txClient.query(lockSql, accountIds);

          const lockedAccountsMap = new Map<string, Record<string, unknown>>();
          for (const row of lockRes.rows) {
            lockedAccountsMap.set(row.id as string, row as Record<string, unknown>);
          }

          // Verify all referenced accounts exist and are ACTIVE
          for (const accountId of accountIds) {
            const accountRow = lockedAccountsMap.get(accountId);
            if (!accountRow) {
              throw new RepositoryNotFoundError('LedgerAccount', accountId);
            }
            if (accountRow.status !== AccountStatus.ACTIVE) {
              throw new InvalidWalletStateError(accountRow.status as string, undefined, {
                accountId,
                reason: `Account '${accountId}' is not active (status: ${accountRow.status})`,
              });
            }
          }

          // Verify transaction currency matches account currencies
          const txCurrency = transaction.getCurrency();
          for (const accountId of accountIds) {
            const accountRow = lockedAccountsMap.get(accountId)!;
            if ((accountRow.currency as string).toUpperCase() !== txCurrency) {
              throw new CurrencyMismatchError(
                accountRow.currency as string,
                txCurrency,
                `Account '${accountId}' currency (${accountRow.currency}) does not match transaction currency (${txCurrency})`,
              );
            }
          }

          // Save transaction header
          const saveTxSql = `
            INSERT INTO ledger_transactions (
              id, description, idempotency_key, reference, status, metadata, created_at, posted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              posted_at = EXCLUDED.posted_at
            WHERE ledger_transactions.status != 'POSTED'
            RETURNING *
          `;
          const txValues = [
            transaction.id,
            transaction.description,
            transaction.idempotencyKey ?? null,
            transaction.reference ?? null,
            transaction.status,
            JSON.stringify(transaction.metadata || {}),
            transaction.createdAt,
            transaction.postedAt ?? new Date(),
          ];
          await txClient.query(saveTxSql, txValues);

          // Delete any existing draft entries if updating a draft to posted
          await txClient.query(`DELETE FROM ledger_entries WHERE transaction_id = $1`, [
            transaction.id,
          ]);

          // Save entries and apply exact BigInt balance updates
          for (const entry of transaction.entries) {
            const saveEntrySql = `
              INSERT INTO ledger_entries (
                id, transaction_id, account_id, direction, amount, currency, memo, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
            const entryValues = [
              entry.id,
              transaction.id,
              entry.accountId,
              entry.direction,
              entry.amount.amount.toString(),
              entry.amount.currency,
              entry.memo ?? null,
              entry.createdAt,
            ];
            await txClient.query(saveEntrySql, entryValues);

            // Materialized Balance Update
            const accountRow = lockedAccountsMap.get(entry.accountId)!;
            const accountType = accountRow.type as AccountType;
            let delta = entry.amount.amount;

            if (accountType === AccountType.ASSET || accountType === AccountType.EXPENSE) {
              if (entry.direction === EntryDirection.CREDIT) {
                delta = -delta;
              }
            } else {
              // LIABILITY, EQUITY, REVENUE
              if (entry.direction === EntryDirection.DEBIT) {
                delta = -delta;
              }
            }

            const updateBalanceSql = `
              UPDATE ledger_accounts
              SET balance = balance + $1, updated_at = NOW()
              WHERE id = $2
            `;
            await txClient.query(updateBalanceSql, [delta.toString(), entry.accountId]);
          }
        } else {
          // Saving DRAFT or REJECTED transaction
          const saveTxSql = `
            INSERT INTO ledger_transactions (
              id, description, idempotency_key, reference, status, metadata, created_at, posted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
              description = EXCLUDED.description,
              status = EXCLUDED.status,
              metadata = EXCLUDED.metadata
            RETURNING *
          `;
          const txValues = [
            transaction.id,
            transaction.description,
            transaction.idempotencyKey ?? null,
            transaction.reference ?? null,
            transaction.status,
            JSON.stringify(transaction.metadata || {}),
            transaction.createdAt,
            transaction.postedAt ?? null,
          ];
          await txClient.query(saveTxSql, txValues);

          for (const entry of transaction.entries) {
            const saveEntrySql = `
              INSERT INTO ledger_entries (
                id, transaction_id, account_id, direction, amount, currency, memo, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (id) DO NOTHING
            `;
            const entryValues = [
              entry.id,
              transaction.id,
              entry.accountId,
              entry.direction,
              entry.amount.amount.toString(),
              entry.amount.currency,
              entry.memo ?? null,
              entry.createdAt,
            ];
            await txClient.query(saveEntrySql, entryValues);
          }
        }

        // Return saved transaction
        const savedTx = await this.getTransactionById(transaction.id);
        if (!savedTx) {
          throw new Error(`Failed to retrieve saved transaction '${transaction.id}'`);
        }
        return savedTx;
      });
    } catch (err) {
      // Check if error is due to a PostgreSQL unique violation (code 23505) during concurrent duplicate requests
      const pgErr = err as { code?: string };
      if (pgErr.code === '23505') {
        // Fallback check: If concurrent duplicate request raced and failed on constraint, re-fetch posted transaction
        if (transaction.idempotencyKey) {
          let existingByKey = await this.getTransactionByIdempotencyKey(
            transaction.idempotencyKey,
          );
          for (let i = 0; i < 10 && existingByKey && existingByKey.entries.length < 2; i++) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            existingByKey = await this.getTransactionByIdempotencyKey(
              transaction.idempotencyKey,
            );
          }
          if (existingByKey && existingByKey.entries.length >= 2) {
            if (this.areTransactionsPayloadEqual(existingByKey, transaction)) {
              return existingByKey;
            } else {
              throw new PersistenceConflictError(
                `Idempotency key conflict: key '${transaction.idempotencyKey}' was previously used with different transaction payload`,
                { idempotencyKey: transaction.idempotencyKey },
                err,
              );
            }
          }
        }

        let existingById = await this.getTransactionById(transaction.id);
        for (let i = 0; i < 10 && existingById && existingById.entries.length < 2; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          existingById = await this.getTransactionById(transaction.id);
        }
        if (existingById && existingById.entries.length >= 2) {
          if (
            existingById.status === TransactionStatus.POSTED &&
            this.areTransactionsPayloadEqual(existingById, transaction)
          ) {
            return existingById;
          }
        }
      }

      throw mapWalletPgError(err, `Failed to save ledger transaction '${transaction.id}'`);
    }
  }

  private areTransactionsEqual(a: LedgerTransaction, b: LedgerTransaction): boolean {
    if (a.id !== b.id || a.status !== b.status) {
      return false;
    }
    return this.areTransactionsPayloadEqual(a, b);
  }

  private areTransactionsPayloadEqual(a: LedgerTransaction, b: LedgerTransaction): boolean {
    if (a.description !== b.description || a.entries.length !== b.entries.length) {
      return false;
    }

    const sortEntries = (entries: readonly LedgerEntry[]) =>
      [...entries].sort((x, y) =>
        `${x.accountId}_${x.direction}`.localeCompare(`${y.accountId}_${y.direction}`),
      );

    const sortedA = sortEntries(a.entries);
    const sortedB = sortEntries(b.entries);

    for (let i = 0; i < sortedA.length; i++) {
      const ea = sortedA[i]!;
      const eb = sortedB[i]!;
      if (
        ea.accountId !== eb.accountId ||
        ea.direction !== eb.direction ||
        !ea.amount.equals(eb.amount)
      ) {
        return false;
      }
    }
    return true;
  }

  private mapRowToAccount(row: Record<string, unknown>): LedgerAccount {
    const rawMetadata = row.metadata;
    let metadata: Record<string, unknown> | undefined = undefined;
    if (typeof rawMetadata === 'string') {
      try {
        metadata = JSON.parse(rawMetadata);
      } catch {
        metadata = undefined;
      }
    } else if (rawMetadata && typeof rawMetadata === 'object') {
      metadata = rawMetadata as Record<string, unknown>;
    }

    return new LedgerAccount({
      id: row.id as string,
      name: row.name as string,
      type: row.type as AccountType,
      currency: row.currency as string,
      walletId: (row.wallet_id as string) || undefined,
      status: row.status as AccountStatus,
      createdAt: new Date(row.created_at as string | Date),
      metadata,
    });
  }

  private mapRowToEntry(row: Record<string, unknown>): LedgerEntry {
    const amountStr = typeof row.amount === 'bigint' ? row.amount.toString() : String(row.amount);
    return new LedgerEntry({
      id: row.id as string,
      transactionId: (row.transaction_id as string) || undefined,
      accountId: row.account_id as string,
      direction: row.direction as EntryDirection,
      amount: Money.fromMinor(amountStr, row.currency as string),
      memo: (row.memo as string) || undefined,
      createdAt: new Date(row.created_at as string | Date),
    });
  }

  private mapRowToTransaction(
    row: Record<string, unknown>,
    entries: LedgerEntry[],
  ): LedgerTransaction {
    const rawMetadata = row.metadata;
    let metadata: Record<string, unknown> | undefined = undefined;
    if (typeof rawMetadata === 'string') {
      try {
        metadata = JSON.parse(rawMetadata);
      } catch {
        metadata = undefined;
      }
    } else if (rawMetadata && typeof rawMetadata === 'object') {
      metadata = rawMetadata as Record<string, unknown>;
    }

    return new LedgerTransaction({
      id: row.id as string,
      description: row.description as string,
      idempotencyKey: (row.idempotency_key as string) || undefined,
      reference: (row.reference as string) || undefined,
      status: row.status as TransactionStatus,
      entries,
      createdAt: new Date(row.created_at as string | Date),
      postedAt: row.posted_at ? new Date(row.posted_at as string | Date) : undefined,
      metadata,
    });
  }
}
