import { describe, expect, it } from 'vitest';
import {
  CurrencyMismatchError,
  EmptyTransactionError,
  EntryDirection,
  ImmutableTransactionError,
  InvalidLedgerEntryError,
  LedgerEntry,
  LedgerTransaction,
  Money,
  TransactionStatus,
  UnbalancedTransactionError,
} from '../src/index.js';

describe('LedgerTransaction Aggregate & Entries', () => {
  it('should accept and post a balanced double-entry transaction', () => {
    const entry1 = new LedgerEntry({
      id: 'e-1',
      accountId: 'acc-clearing',
      direction: EntryDirection.DEBIT,
      amount: Money.fromMinor(10000n, 'IRR'),
      memo: 'Topup via Gateway',
    });

    const entry2 = new LedgerEntry({
      id: 'e-2',
      accountId: 'acc-wallet-balance',
      direction: EntryDirection.CREDIT,
      amount: Money.fromMinor(10000n, 'IRR'),
      memo: 'Credit user wallet',
    });

    const tx = LedgerTransaction.draft({
      id: 'tx-1',
      description: 'Wallet Topup',
      idempotencyKey: 'idemp-topup-001',
      entries: [entry1, entry2],
    });

    expect(tx.status).toBe(TransactionStatus.DRAFT);
    expect(tx.entries).toHaveLength(2);

    tx.post();

    expect(tx.status).toBe(TransactionStatus.POSTED);
    expect(tx.postedAt).toBeInstanceOf(Date);
  });

  it('should reject an unbalanced transaction during posting', () => {
    const entry1 = new LedgerEntry({
      id: 'e-1',
      accountId: 'acc-clearing',
      direction: EntryDirection.DEBIT,
      amount: Money.fromMinor(10000n, 'IRR'),
    });

    const entry2 = new LedgerEntry({
      id: 'e-2',
      accountId: 'acc-wallet-balance',
      direction: EntryDirection.CREDIT,
      amount: Money.fromMinor(9000n, 'IRR'), // 1000 unbalance
    });

    const tx = LedgerTransaction.draft({
      id: 'tx-unbalanced',
      description: 'Invalid Topup',
      entries: [entry1, entry2],
    });

    expect(() => tx.post()).toThrow(UnbalancedTransactionError);
  });

  it('should reject mixed currency entries in a transaction', () => {
    const entry1 = new LedgerEntry({
      id: 'e-1',
      accountId: 'acc-1',
      direction: EntryDirection.DEBIT,
      amount: Money.fromMinor(100n, 'USD'),
    });

    const entry2 = new LedgerEntry({
      id: 'e-2',
      accountId: 'acc-2',
      direction: EntryDirection.CREDIT,
      amount: Money.fromMinor(100n, 'EUR'),
    });

    const tx = LedgerTransaction.draft({
      id: 'tx-mixed',
      description: 'Mixed Currency Tx',
      entries: [entry1, entry2],
    });

    expect(() => tx.post()).toThrow(CurrencyMismatchError);
  });

  it('should reject empty or single-entry transactions', () => {
    const emptyTx = LedgerTransaction.draft({
      id: 'tx-empty',
      description: 'Empty Tx',
      entries: [],
    });

    expect(() => emptyTx.post()).toThrow(EmptyTransactionError);

    const singleTx = LedgerTransaction.draft({
      id: 'tx-single',
      description: 'Single Entry Tx',
      entries: [
        new LedgerEntry({
          id: 'e-1',
          accountId: 'acc-1',
          direction: EntryDirection.DEBIT,
          amount: Money.fromMinor(100n, 'USD'),
        }),
      ],
    });

    expect(() => singleTx.post()).toThrow(EmptyTransactionError);
  });

  it('should enforce strict entry amount positivity (> 0)', () => {
    expect(() => {
      new LedgerEntry({
        id: 'e-zero',
        accountId: 'acc-1',
        direction: EntryDirection.DEBIT,
        amount: Money.fromMinor(0n, 'USD'),
      });
    }).toThrow(InvalidLedgerEntryError);

    expect(() => {
      new LedgerEntry({
        id: 'e-neg',
        accountId: 'acc-1',
        direction: EntryDirection.DEBIT,
        amount: Money.fromMinor(-100n, 'USD'),
      });
    }).toThrow(InvalidLedgerEntryError);
  });

  it('should enforce posted transaction immutability', () => {
    const tx = LedgerTransaction.draft({
      id: 'tx-immut',
      description: 'Immutable test',
      entries: [
        new LedgerEntry({
          id: 'e-1',
          accountId: 'acc-1',
          direction: EntryDirection.DEBIT,
          amount: Money.fromMinor(500n, 'USD'),
        }),
        new LedgerEntry({
          id: 'e-2',
          accountId: 'acc-2',
          direction: EntryDirection.CREDIT,
          amount: Money.fromMinor(500n, 'USD'),
        }),
      ],
    });

    tx.post();

    // Re-posting throws
    expect(() => tx.post()).toThrow(ImmutableTransactionError);

    // Adding entry throws
    expect(() => {
      tx.addEntry(
        new LedgerEntry({
          id: 'e-3',
          accountId: 'acc-3',
          direction: EntryDirection.DEBIT,
          amount: Money.fromMinor(100n, 'USD'),
        }),
      );
    }).toThrow(ImmutableTransactionError);

    // Entries array is frozen
    expect(Object.isFrozen(tx.entries)).toBe(true);
  });

  it('should create valid compensating transaction for a posted transaction', () => {
    const tx = LedgerTransaction.draft({
      id: 'tx-original',
      description: 'Original Purchase',
      entries: [
        new LedgerEntry({
          id: 'e-1',
          accountId: 'acc-wallet',
          direction: EntryDirection.DEBIT,
          amount: Money.fromMinor(2000n, 'IRT'),
        }),
        new LedgerEntry({
          id: 'e-2',
          accountId: 'acc-revenue',
          direction: EntryDirection.CREDIT,
          amount: Money.fromMinor(2000n, 'IRT'),
        }),
      ],
    });

    tx.post();

    const compTx = tx.createCompensatingTransaction('tx-comp-1', 'Refund Purchase');

    expect(compTx.status).toBe(TransactionStatus.DRAFT);
    expect(compTx.reference).toBe('tx-original');
    expect(compTx.entries).toHaveLength(2);

    // Entry 1 was DEBIT -> now CREDIT
    expect(compTx.entries[0]?.accountId).toBe('acc-wallet');
    expect(compTx.entries[0]?.direction).toBe(EntryDirection.CREDIT);
    expect(compTx.entries[0]?.amount.amount).toBe(2000n);

    // Entry 2 was CREDIT -> now DEBIT
    expect(compTx.entries[1]?.accountId).toBe('acc-revenue');
    expect(compTx.entries[1]?.direction).toBe(EntryDirection.DEBIT);
    expect(compTx.entries[1]?.amount.amount).toBe(2000n);

    // Compensating transaction can be posted
    compTx.post();
    expect(compTx.status).toBe(TransactionStatus.POSTED);
  });
});
