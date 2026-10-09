import {
  BalanceProjectionMismatch,
  IReconciliationRepository,
  Money,
  UnbalancedTransactionDiscrepancy,
} from '@amirhossein-moloki/wallet-core';
import { PgExecutor } from '../migrator.js';
import { mapWalletPgError } from '../error-mapper.js';

export class PostgresReconciliationRepository implements IReconciliationRepository {
  constructor(private readonly executor: PgExecutor) {}

  public async findUnbalancedTransactions(): Promise<UnbalancedTransactionDiscrepancy[]> {
    try {
      const sql = `
        SELECT transaction_id, description, currency, total_debits, total_credits
        FROM (
          SELECT
            t.id AS transaction_id,
            t.description,
            e.currency,
            SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount ELSE 0 END) AS total_debits,
            SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE 0 END) AS total_credits
          FROM ledger_transactions t
          JOIN ledger_entries e ON t.id = e.transaction_id
          WHERE t.status = 'POSTED'
          GROUP BY t.id, t.description, e.currency
        ) sub
        WHERE total_debits != total_credits
      `;

      const res = await this.executor.query(sql, []);

      return res.rows.map((row) => {
        const currency = row.currency as string;
        const debitsStr =
          typeof row.total_debits === 'bigint'
            ? row.total_debits.toString()
            : String(row.total_debits);
        const creditsStr =
          typeof row.total_credits === 'bigint'
            ? row.total_credits.toString()
            : String(row.total_credits);

        return {
          transactionId: row.transaction_id as string,
          description: row.description as string,
          debits: Money.fromMinor(debitsStr, currency),
          credits: Money.fromMinor(creditsStr, currency),
          currency,
        };
      });
    } catch (err) {
      throw mapWalletPgError(err, 'Failed to execute query to find unbalanced transactions');
    }
  }

  public async findBalanceMismatches(): Promise<BalanceProjectionMismatch[]> {
    try {
      const sql = `
        SELECT account_id, wallet_id, currency, account_type, stored_balance, derived_balance
        FROM (
          SELECT
            a.id AS account_id,
            a.wallet_id,
            a.currency,
            a.type AS account_type,
            a.balance AS stored_balance,
            COALESCE(
              SUM(
                CASE
                  WHEN t.id IS NOT NULL THEN
                    CASE
                      WHEN a.type IN ('ASSET', 'EXPENSE') THEN
                        CASE WHEN e.direction = 'DEBIT' THEN e.amount ELSE -e.amount END
                      ELSE
                        CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE -e.amount END
                    END
                  ELSE 0
                END
              ),
              0
            ) AS derived_balance
          FROM ledger_accounts a
          LEFT JOIN ledger_entries e ON a.id = e.account_id
          LEFT JOIN ledger_transactions t ON e.transaction_id = t.id AND t.status = 'POSTED'
          GROUP BY a.id, a.wallet_id, a.currency, a.type, a.balance
        ) sub
        WHERE stored_balance != derived_balance
      `;

      const res = await this.executor.query(sql, []);

      return res.rows.map((row) => {
        const currency = row.currency as string;
        const storedStr =
          typeof row.stored_balance === 'bigint'
            ? row.stored_balance.toString()
            : String(row.stored_balance);
        const derivedStr =
          typeof row.derived_balance === 'bigint'
            ? row.derived_balance.toString()
            : String(row.derived_balance);

        const storedBalance = Money.fromMinor(storedStr, currency);
        const derivedBalance = Money.fromMinor(derivedStr, currency);
        const difference = storedBalance.subtract(derivedBalance);

        return {
          accountId: row.account_id as string,
          walletId: (row.wallet_id as string) || undefined,
          storedBalance,
          ledgerDerivedBalance: derivedBalance,
          currency,
          difference,
        };
      });
    } catch (err) {
      throw mapWalletPgError(err, 'Failed to execute query to find balance mismatches');
    }
  }
}
