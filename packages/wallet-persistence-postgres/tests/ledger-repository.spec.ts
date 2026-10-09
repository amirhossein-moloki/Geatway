import { describe, it, expect, beforeEach } from 'vitest';
import {
  AccountType,
  CurrencyMismatchError,
  EntryDirection,
  ImmutableTransactionError,
  InvalidAmountError,
  LedgerAccount,
  LedgerEntry,
  LedgerTransaction,
  Money,
  TransactionStatus,
  UnbalancedTransactionError,
  Wallet,
} from '@amirhossein-moloki/wallet-core';
import {
  PersistenceConflictError,
  RepositoryNotFoundError,
} from '@amirhossein-moloki/payment-core';
import { PostgresWalletRepository } from '../src/repositories/postgres-wallet-repository.js';
import { PostgresLedgerRepository } from '../src/repositories/postgres-ledger-repository.js';
import { createTestDatabase } from './test-utils.js';
import { PgExecutor } from '../src/migrator.js';

describe('PostgresLedgerRepository', () => {
  let db: PgExecutor;
  let walletRepo: PostgresWalletRepository;
  let ledgerRepo: PostgresLedgerRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    walletRepo = new PostgresWalletRepository(db);
    ledgerRepo = new PostgresLedgerRepository(db);
  });

  describe('Ledger Accounts', () => {
    it('should save and retrieve ledger account by ID, walletId, and type', async () => {
      const wallet = Wallet.create({
        id: 'w_acc_1',
        ownerId: 'u_1',
        currency: 'IRR',
      });
      await walletRepo.save(wallet);

      const account = LedgerAccount.create({
        id: 'acc_balance_1',
        name: 'User Available Balance',
        type: AccountType.LIABILITY,
        currency: 'IRR',
        walletId: wallet.id,
      });

      const saved = await ledgerRepo.saveAccount(account);
      expect(saved.id).toBe('acc_balance_1');
      expect(saved.type).toBe(AccountType.LIABILITY);
      expect(saved.walletId).toBe('w_acc_1');

      const foundById = await ledgerRepo.findAccountById('acc_balance_1');
      expect(foundById).not.toBeNull();
      expect(foundById?.name).toBe('User Available Balance');

      const foundByType = await ledgerRepo.findAccountByWalletIdAndType(
        wallet.id,
        AccountType.LIABILITY,
      );
      expect(foundByType?.id).toBe('acc_balance_1');

      const walletAccounts = await ledgerRepo.findAccountsByWalletId(wallet.id);
      expect(walletAccounts.length).toBe(1);
    });

    it('should return initial zero balance for newly created account', async () => {
      const account = LedgerAccount.create({
        id: 'acc_zero',
        name: 'Settlement Account',
        type: AccountType.ASSET,
        currency: 'IRR',
      });
      await ledgerRepo.saveAccount(account);

      const balance = await ledgerRepo.getAccountBalance('acc_zero');
      expect(balance.amount).toBe(0n);
      expect(balance.currency).toBe('IRR');
    });

    it('should throw RepositoryNotFoundError for non-existent account balance lookup', async () => {
      await expect(ledgerRepo.getAccountBalance('non_existent_acc')).rejects.toThrow(
        RepositoryNotFoundError,
      );
    });
  });

  describe('Atomic Ledger Posting & Integrity', () => {
    let bankAssetAcc: LedgerAccount;
    let userLiabilityAcc: LedgerAccount;
    let merchantRevenueAcc: LedgerAccount;

    beforeEach(async () => {
      bankAssetAcc = await ledgerRepo.saveAccount(
        LedgerAccount.create({
          id: 'acc_bank_asset',
          name: 'Bank Settlement Asset',
          type: AccountType.ASSET,
          currency: 'IRR',
        }),
      );

      userLiabilityAcc = await ledgerRepo.saveAccount(
        LedgerAccount.create({
          id: 'acc_user_liability',
          name: 'User Balance Liability',
          type: AccountType.LIABILITY,
          currency: 'IRR',
        }),
      );

      merchantRevenueAcc = await ledgerRepo.saveAccount(
        LedgerAccount.create({
          id: 'acc_merchant_revenue',
          name: 'Merchant Revenue',
          type: AccountType.REVENUE,
          currency: 'IRR',
        }),
      );
    });

    it('should atomically post a balanced transaction and update materialized balances', async () => {
      // Top-up deposit transaction: Bank ASSET (Debit 1,000,000), User LIABILITY (Credit 1,000,000)
      const tx = LedgerTransaction.draft({
        id: 'tx_topup_100',
        description: 'Wallet top-up deposit',
        entries: [
          new LedgerEntry({
            id: 'e_1',
            accountId: bankAssetAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(1000000n, 'IRR'),
            memo: 'Bank debit',
          }),
          new LedgerEntry({
            id: 'e_2',
            accountId: userLiabilityAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(1000000n, 'IRR'),
            memo: 'User credit',
          }),
        ],
      });

      tx.post(); // Transition to POSTED

      const postedTx = await ledgerRepo.saveTransaction(tx);
      expect(postedTx.status).toBe(TransactionStatus.POSTED);
      expect(postedTx.postedAt).toBeDefined();

      const bankBalance = await ledgerRepo.getAccountBalance(bankAssetAcc.id);
      expect(bankBalance.amount).toBe(1000000n);

      const userBalance = await ledgerRepo.getAccountBalance(userLiabilityAcc.id);
      expect(userBalance.amount).toBe(1000000n);
    });

    it('should correctly handle multi-step debit and credit operations on balances', async () => {
      // 1. Top-up 1,000,000 IRR
      const depositTx = LedgerTransaction.draft({
        id: 'tx_dep_1',
        description: 'Deposit',
        entries: [
          new LedgerEntry({
            id: 'e_dep_1',
            accountId: bankAssetAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(1000000n, 'IRR'),
          }),
          new LedgerEntry({
            id: 'e_dep_2',
            accountId: userLiabilityAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(1000000n, 'IRR'),
          }),
        ],
      });
      depositTx.post();
      await ledgerRepo.saveTransaction(depositTx);

      // 2. User spends 300,000 IRR (User LIABILITY debit 300k, Merchant REVENUE credit 300k)
      const spendTx = LedgerTransaction.draft({
        id: 'tx_spend_1',
        description: 'Checkout Purchase',
        entries: [
          new LedgerEntry({
            id: 'e_spend_1',
            accountId: userLiabilityAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(300000n, 'IRR'),
          }),
          new LedgerEntry({
            id: 'e_spend_2',
            accountId: merchantRevenueAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(300000n, 'IRR'),
          }),
        ],
      });
      spendTx.post();
      await ledgerRepo.saveTransaction(spendTx);

      const userBal = await ledgerRepo.getAccountBalance(userLiabilityAcc.id);
      expect(userBal.amount).toBe(700000n); // 1,000,000 - 300,000 = 700,000

      const merchantBal = await ledgerRepo.getAccountBalance(merchantRevenueAcc.id);
      expect(merchantBal.amount).toBe(300000n);
    });

    it('should reject unbalanced transactions and leave balances untouched', async () => {
      const unbalancedTx = LedgerTransaction.draft({
        id: 'tx_unbalanced',
        description: 'Invalid unbalanced transaction',
        entries: [
          new LedgerEntry({
            id: 'e_u1',
            accountId: bankAssetAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(500000n, 'IRR'),
          }),
          new LedgerEntry({
            id: 'e_u2',
            accountId: userLiabilityAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(100000n, 'IRR'), // Mismatched credit
          }),
        ],
      });

      // Attempting to post unbalanced transaction directly
      expect(() => unbalancedTx.post()).toThrow(UnbalancedTransactionError);

      const bankBalanceBefore = await ledgerRepo.getAccountBalance(bankAssetAcc.id);
      expect(bankBalanceBefore.amount).toBe(0n);
    });

    it('should reject transaction referencing non-existent account and roll back writes', async () => {
      const invalidAccTx = LedgerTransaction.draft({
        id: 'tx_invalid_acc',
        description: 'Transaction with missing account',
        entries: [
          new LedgerEntry({
            id: 'e_i1',
            accountId: bankAssetAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(100000n, 'IRR'),
          }),
          new LedgerEntry({
            id: 'e_i2',
            accountId: 'acc_missing_404',
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(100000n, 'IRR'),
          }),
        ],
      });
      invalidAccTx.post();

      await expect(ledgerRepo.saveTransaction(invalidAccTx)).rejects.toThrow(
        RepositoryNotFoundError,
      );

      // Verify no transaction record was persisted
      const fetched = await ledgerRepo.getTransactionById('tx_invalid_acc');
      expect(fetched).toBeNull();

      // Verify account balance was unchanged
      const bankBal = await ledgerRepo.getAccountBalance(bankAssetAcc.id);
      expect(bankBal.amount).toBe(0n);
    });

    it('should reject currency mismatch between transaction entries and account currency', async () => {
      const usdTx = LedgerTransaction.draft({
        id: 'tx_usd_mismatch',
        description: 'USD transaction on IRR account',
        entries: [
          new LedgerEntry({
            id: 'e_usd_1',
            accountId: bankAssetAcc.id, // IRR account
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(1000n, 'USD'),
          }),
          new LedgerEntry({
            id: 'e_usd_2',
            accountId: userLiabilityAcc.id, // IRR account
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(1000n, 'USD'),
          }),
        ],
      });
      usdTx.post();

      await expect(ledgerRepo.saveTransaction(usdTx)).rejects.toThrow(CurrencyMismatchError);
    });

    it('should preserve exact precision for large integer minor units', async () => {
      const largeAmount = Money.fromMinor('5000000000000', 'IRR'); // 5 trillion minor units

      const largeTx = LedgerTransaction.draft({
        id: 'tx_large_amount',
        description: 'Large amount transaction',
        entries: [
          new LedgerEntry({
            id: 'e_large_1',
            accountId: bankAssetAcc.id,
            direction: EntryDirection.DEBIT,
            amount: largeAmount,
          }),
          new LedgerEntry({
            id: 'e_large_2',
            accountId: userLiabilityAcc.id,
            direction: EntryDirection.CREDIT,
            amount: largeAmount,
          }),
        ],
      });
      largeTx.post();

      await ledgerRepo.saveTransaction(largeTx);

      const bankBal = await ledgerRepo.getAccountBalance(bankAssetAcc.id);
      expect(bankBal.amount).toBe(5000000000000n);

      const userBal = await ledgerRepo.getAccountBalance(userLiabilityAcc.id);
      expect(userBal.amount).toBe(5000000000000n);
    });

    it('should reject invalid amount formats (floats, non-integer strings)', () => {
      expect(() => Money.fromMinor(100.5, 'IRR')).toThrow(InvalidAmountError);
      expect(() => Money.fromMinor('invalid_number', 'IRR')).toThrow(InvalidAmountError);
    });

    it('should guarantee atomicity and leave zero records on execution error', async () => {
      // Create a transaction that fails due to an inactive account
      const inactiveAcc = await ledgerRepo.saveAccount(
        LedgerAccount.create({
          id: 'acc_inactive_1',
          name: 'Inactive Account',
          type: AccountType.LIABILITY,
          currency: 'IRR',
        }),
      );
      // Manually set status to FROZEN
      await db.query(`UPDATE ledger_accounts SET status = 'FROZEN' WHERE id = 'acc_inactive_1'`);

      const tx = LedgerTransaction.draft({
        id: 'tx_frozen_test',
        description: 'Attempt transfer to frozen account',
        entries: [
          new LedgerEntry({
            id: 'e_fr_1',
            accountId: bankAssetAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(100000n, 'IRR'),
          }),
          new LedgerEntry({
            id: 'e_fr_2',
            accountId: inactiveAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(100000n, 'IRR'),
          }),
        ],
      });
      tx.post();

      await expect(ledgerRepo.saveTransaction(tx)).rejects.toThrow();

      // Check that transaction was NOT saved
      const savedTx = await ledgerRepo.getTransactionById('tx_frozen_test');
      expect(savedTx).toBeNull();

      // Check that bank account balance remains 0
      const bankBal = await ledgerRepo.getAccountBalance(bankAssetAcc.id);
      expect(bankBal.amount).toBe(0n);
    });
  });

  describe('Idempotency & Duplicate Requests', () => {
    let bankAcc: LedgerAccount;
    let userAcc: LedgerAccount;

    beforeEach(async () => {
      bankAcc = await ledgerRepo.saveAccount(
        LedgerAccount.create({
          id: 'acc_idemp_bank',
          name: 'Bank',
          type: AccountType.ASSET,
          currency: 'IRR',
        }),
      );
      userAcc = await ledgerRepo.saveAccount(
        LedgerAccount.create({
          id: 'acc_idemp_user',
          name: 'User',
          type: AccountType.LIABILITY,
          currency: 'IRR',
        }),
      );
    });

    it('should replay existing transaction when called with duplicate idempotency key and matching payload', async () => {
      const tx = LedgerTransaction.draft({
        id: 'tx_idemp_orig',
        description: 'Idempotent deposit',
        idempotencyKey: 'idemp_key_999',
        entries: [
          new LedgerEntry({
            id: 'e_idemp_1',
            accountId: bankAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(500000n, 'IRR'),
          }),
          new LedgerEntry({
            id: 'e_idemp_2',
            accountId: userAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(500000n, 'IRR'),
          }),
        ],
      });
      tx.post();

      const firstResult = await ledgerRepo.saveTransaction(tx);
      expect(firstResult.id).toBe('tx_idemp_orig');

      // Duplicate request with different transaction ID but SAME idempotency key and payload
      const dupTx = LedgerTransaction.draft({
        id: 'tx_idemp_dup',
        description: 'Idempotent deposit',
        idempotencyKey: 'idemp_key_999',
        entries: [
          new LedgerEntry({
            id: 'e_idemp_dup1',
            accountId: bankAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(500000n, 'IRR'),
          }),
          new LedgerEntry({
            id: 'e_idemp_dup2',
            accountId: userAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(500000n, 'IRR'),
          }),
        ],
      });
      dupTx.post();

      const secondResult = await ledgerRepo.saveTransaction(dupTx);
      expect(secondResult.id).toBe('tx_idemp_orig'); // Returned original posted tx

      // Verify balance was ONLY credited once (500,000 IRR)
      const userBal = await ledgerRepo.getAccountBalance(userAcc.id);
      expect(userBal.amount).toBe(500000n);
    });

    it('should throw PersistenceConflictError when idempotency key is reused with conflicting payload', async () => {
      const tx = LedgerTransaction.draft({
        id: 'tx_idemp_first',
        description: 'First attempt',
        idempotencyKey: 'idemp_key_conflict',
        entries: [
          new LedgerEntry({
            id: 'e_c1',
            accountId: bankAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(100000n, 'IRR'),
          }),
          new LedgerEntry({
            id: 'e_c2',
            accountId: userAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(100000n, 'IRR'),
          }),
        ],
      });
      tx.post();
      await ledgerRepo.saveTransaction(tx);

      // Conflicting payload with DIFFERENT amount (200,000 IRR)
      const conflictTx = LedgerTransaction.draft({
        id: 'tx_idemp_second',
        description: 'First attempt',
        idempotencyKey: 'idemp_key_conflict',
        entries: [
          new LedgerEntry({
            id: 'e_c3',
            accountId: bankAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(200000n, 'IRR'), // Different amount!
          }),
          new LedgerEntry({
            id: 'e_c4',
            accountId: userAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(200000n, 'IRR'),
          }),
        ],
      });
      conflictTx.post();

      await expect(ledgerRepo.saveTransaction(conflictTx)).rejects.toThrow(
        PersistenceConflictError,
      );
    });
  });

  describe('Immutability & Compensating Transactions', () => {
    let bankAcc: LedgerAccount;
    let userAcc: LedgerAccount;

    beforeEach(async () => {
      bankAcc = await ledgerRepo.saveAccount(
        LedgerAccount.create({
          id: 'acc_imm_bank',
          name: 'Bank',
          type: AccountType.ASSET,
          currency: 'IRR',
        }),
      );
      userAcc = await ledgerRepo.saveAccount(
        LedgerAccount.create({
          id: 'acc_imm_user',
          name: 'User',
          type: AccountType.LIABILITY,
          currency: 'IRR',
        }),
      );
    });

    it('should throw ImmutableTransactionError when attempting to re-post or modify a POSTED transaction', async () => {
      const tx = LedgerTransaction.draft({
        id: 'tx_immutable_1',
        description: 'Posted deposit',
        entries: [
          new LedgerEntry({
            id: 'e_im1',
            accountId: bankAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(250000n, 'IRR'),
          }),
          new LedgerEntry({
            id: 'e_im2',
            accountId: userAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(250000n, 'IRR'),
          }),
        ],
      });
      tx.post();
      await ledgerRepo.saveTransaction(tx);

      // Modify description and attempt to save under same ID
      const modifiedTx = new LedgerTransaction({
        id: 'tx_immutable_1',
        description: 'Modified description',
        status: TransactionStatus.POSTED,
        entries: [...tx.entries],
        createdAt: tx.createdAt,
        postedAt: tx.postedAt,
      });

      await expect(ledgerRepo.saveTransaction(modifiedTx)).rejects.toThrow(
        ImmutableTransactionError,
      );
    });

    it('should successfully reverse a posted transaction using a compensating transaction', async () => {
      // 1. Original transaction (Deposit 400,000)
      const origTx = LedgerTransaction.draft({
        id: 'tx_to_reverse',
        description: 'Incorrect Deposit',
        entries: [
          new LedgerEntry({
            id: 'e_rev_1',
            accountId: bankAcc.id,
            direction: EntryDirection.DEBIT,
            amount: Money.fromMinor(400000n, 'IRR'),
          }),
          new LedgerEntry({
            id: 'e_rev_2',
            accountId: userAcc.id,
            direction: EntryDirection.CREDIT,
            amount: Money.fromMinor(400000n, 'IRR'),
          }),
        ],
      });
      origTx.post();
      await ledgerRepo.saveTransaction(origTx);

      const balAfterDeposit = await ledgerRepo.getAccountBalance(userAcc.id);
      expect(balAfterDeposit.amount).toBe(400000n);

      // 2. Create compensating transaction
      const compTx = origTx.createCompensatingTransaction(
        'tx_reversal_1',
        'Reversal of tx_to_reverse',
      );
      compTx.post();

      await ledgerRepo.saveTransaction(compTx);

      // Balance should be restored to 0
      const balAfterReversal = await ledgerRepo.getAccountBalance(userAcc.id);
      expect(balAfterReversal.amount).toBe(0n);

      // Original transaction remains POSTED and unmodified
      const reloadedOrig = await ledgerRepo.getTransactionById('tx_to_reverse');
      expect(reloadedOrig?.status).toBe(TransactionStatus.POSTED);
    });
  });
});
