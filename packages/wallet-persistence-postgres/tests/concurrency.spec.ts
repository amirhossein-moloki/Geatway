import { describe, it, expect, beforeEach } from 'vitest';
import {
  AccountType,
  EntryDirection,
  LedgerAccount,
  LedgerEntry,
  LedgerTransaction,
  Money,
} from '@amirhossein-moloki/wallet-core';
import { PersistenceConflictError } from '@amirhossein-moloki/payment-core';
import { PostgresLedgerRepository } from '../src/repositories/postgres-ledger-repository.js';
import { createTestDatabase } from './test-utils.js';
import { PgExecutor } from '../src/migrator.js';
import { mapWalletPgError } from '../src/error-mapper.js';

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

  it('should result in at most one financial posting during concurrent duplicate requests', async () => {
    const accBank = await ledgerRepo.saveAccount(
      LedgerAccount.create({
        id: 'acc_dup_bank',
        name: 'Bank',
        type: AccountType.ASSET,
        currency: 'IRR',
      }),
    );

    const accUser = await ledgerRepo.saveAccount(
      LedgerAccount.create({
        id: 'acc_dup_user',
        name: 'User',
        type: AccountType.LIABILITY,
        currency: 'IRR',
      }),
    );

    const idempotencyKey = 'concurrent_dup_key_777';

    // Build 10 concurrent requests with the SAME idempotency key and identical payload
    const tasks = Array.from({ length: 10 }, (_, i) => {
      const tx = LedgerTransaction.draft({
        id: `tx_dup_req_${i + 1}`,
        description: 'Concurrent Duplicate Topup',
        idempotencyKey,
        entries: [
          new LedgerEntry({
            id: `e1_dup_${i + 1}`,
            accountId: accBank.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(250000n, 'IRR'),
          }),
          new LedgerEntry({
            id: `e2_dup_${i + 1}`,
            accountId: accUser.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(250000n, 'IRR'),
          }),
        ],
      });
      tx.post();
      return ledgerRepo.saveTransaction(tx);
    });

    const results = await Promise.all(tasks);

    // All results must be valid and reference the SAME posted transaction ID (the first inserted)
    const firstTxId = results[0]!.id;
    for (const res of results) {
      expect(res.id).toBe(firstTxId);
    }

    // Financial balance must be updated EXACTLY ONCE (250,000 IRR, NOT 2,500,000 IRR)
    const bankBal = await ledgerRepo.getAccountBalance(accBank.id);
    expect(bankBal.amount).toBe(250000n);

    const userBal = await ledgerRepo.getAccountBalance(accUser.id);
    expect(userBal.amount).toBe(250000n);
  });

  it('should map PostgreSQL deadlock (40P01) and serialization errors (40001) to PersistenceConflictError', () => {
    const deadlockErr = { code: '40P01', message: 'deadlock detected' };
    const mappedDeadlock = mapWalletPgError(deadlockErr);
    expect(mappedDeadlock).toBeInstanceOf(PersistenceConflictError);
    expect(mappedDeadlock.message).toContain('40P01');

    const serializationErr = {
      code: '40001',
      message: 'could not serialize access due to concurrent update',
    };
    const mappedSerialization = mapWalletPgError(serializationErr);
    expect(mappedSerialization).toBeInstanceOf(PersistenceConflictError);
    expect(mappedSerialization.message).toContain('40001');
  });
});
