import { describe, it, expect, beforeEach } from 'vitest';
import {
  AccountType,
  EntryDirection,
  LedgerAccount,
  LedgerEntry,
  LedgerTransaction,
  Money,
} from '@amirhossein-moloki/wallet-core';
import { PostgresLedgerRepository } from '../src/repositories/postgres-ledger-repository.js';
import { createTestDatabase } from './test-utils.js';
import { PgExecutor } from '../src/migrator.js';

describe('Concurrency and Deterministic Lock Ordering', () => {
  let db: PgExecutor;
  let ledgerRepo: PostgresLedgerRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    ledgerRepo = new PostgresLedgerRepository(db);
  });

  it('should handle concurrent postings safely without race conditions on balances', async () => {
    const accBank = await ledgerRepo.saveAccount(
      LedgerAccount.create({
        id: 'acc_conc_bank',
        name: 'Bank',
        type: AccountType.ASSET,
        currency: 'IRR',
      }),
    );

    const accUser = await ledgerRepo.saveAccount(
      LedgerAccount.create({
        id: 'acc_conc_user',
        name: 'User',
        type: AccountType.LIABILITY,
        currency: 'IRR',
      }),
    );

    // Create 5 concurrent posting tasks of 100,000 IRR each
    const createTx = (id: string) => {
      const tx = LedgerTransaction.draft({
        id,
        description: `Concurrent Topup ${id}`,
        entries: [
          new LedgerEntry({
            id: `e1_${id}`,
            accountId: accBank.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(100000n, 'IRR'),
          }),
          new LedgerEntry({
            id: `e2_${id}`,
            accountId: accUser.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(100000n, 'IRR'),
          }),
        ],
      });
      tx.post();
      return tx;
    };

    const tasks = Array.from({ length: 5 }, (_, i) =>
      ledgerRepo.saveTransaction(createTx(`tx_concurrent_${i + 1}`)),
    );

    await Promise.all(tasks);

    // Total balance must equal exactly 500,000 IRR
    const finalBankBal = await ledgerRepo.getAccountBalance(accBank.id);
    expect(finalBankBal.amount).toBe(500000n);

    const finalUserBal = await ledgerRepo.getAccountBalance(accUser.id);
    expect(finalUserBal.amount).toBe(500000n);
  });

  it('should lock multiple accounts in deterministic sorted order regardless of entry order', async () => {
    const accA = await ledgerRepo.saveAccount(
      LedgerAccount.create({
        id: 'acc_AAA',
        name: 'Account A',
        type: AccountType.ASSET,
        currency: 'IRR',
      }),
    );

    const accB = await ledgerRepo.saveAccount(
      LedgerAccount.create({
        id: 'acc_BBB',
        name: 'Account B',
        type: AccountType.LIABILITY,
        currency: 'IRR',
      }),
    );

    // Tx 1: Entry order A then B
    const tx1 = LedgerTransaction.draft({
      id: 'tx_order_1',
      description: 'A then B',
      entries: [
        new LedgerEntry({
          id: 'e_a1',
          accountId: accA.id,
          direction: EntryDirection.DEBIT,
          amount: Money.fromMinor(50000n, 'IRR'),
        }),
        new LedgerEntry({
          id: 'e_b1',
          accountId: accB.id,
          direction: EntryDirection.CREDIT,
          amount: Money.fromMinor(50000n, 'IRR'),
        }),
      ],
    });
    tx1.post();

    // Tx 2: Entry order B then A
    const tx2 = LedgerTransaction.draft({
      id: 'tx_order_2',
      description: 'B then A',
      entries: [
        new LedgerEntry({
          id: 'e_b2',
          accountId: accB.id,
          direction: EntryDirection.CREDIT,
          amount: Money.fromMinor(30000n, 'IRR'),
        }),
        new LedgerEntry({
          id: 'e_a2',
          accountId: accA.id,
          direction: EntryDirection.DEBIT,
          amount: Money.fromMinor(30000n, 'IRR'),
        }),
      ],
    });
    tx2.post();

    // Execute concurrently - deterministic lock ordering sorts accounts alphabetically ('acc_AAA', 'acc_BBB')
    await Promise.all([ledgerRepo.saveTransaction(tx1), ledgerRepo.saveTransaction(tx2)]);

    const balA = await ledgerRepo.getAccountBalance(accA.id);
    expect(balA.amount).toBe(80000n);

    const balB = await ledgerRepo.getAccountBalance(accB.id);
    expect(balB.amount).toBe(80000n);
  });
});
