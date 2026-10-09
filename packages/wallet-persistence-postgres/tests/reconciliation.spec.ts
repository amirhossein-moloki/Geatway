import { describe, it, expect, beforeEach } from 'vitest';
import { WalletReconciliationService, Money } from '@amirhossein-moloki/wallet-core';
import {
  PostgresReconciliationRepository,
  PostgresLedgerRepository,
  PostgresWalletRepository,
} from '../src/index.js';
import {
  WalletService,
  LedgerTransaction,
  LedgerEntry,
  EntryDirection,
} from '@amirhossein-moloki/wallet-core';
import { PgExecutor } from '../src/migrator.js';
import { createTestDatabase } from './test-utils.js';

describe('PostgresReconciliationRepository Integration Tests', () => {
  let executor: PgExecutor;
  let ledgerRepo: PostgresLedgerRepository;
  let walletRepo: PostgresWalletRepository;
  let reconciliationRepo: PostgresReconciliationRepository;
  let reconciliationService: WalletReconciliationService;
  let walletService: WalletService;

  beforeEach(async () => {
    executor = await createTestDatabase();

    ledgerRepo = new PostgresLedgerRepository(executor);
    walletRepo = new PostgresWalletRepository(executor);
    reconciliationRepo = new PostgresReconciliationRepository(executor);
    reconciliationService = new WalletReconciliationService(reconciliationRepo);

    walletService = new WalletService({
      walletRepository: walletRepo,
      ledgerRepository: ledgerRepo,
    });
  });

  it('detects a clean database state as healthy', async () => {
    await walletService.createWallet('user_rec_1', 'IRR');
    const report = await reconciliationService.reconcile();

    expect(report.isHealthy).toBe(true);
    expect(report.unbalancedTransactions).toHaveLength(0);
    expect(report.balanceMismatches).toHaveLength(0);
  });

  it('ignores draft transactions when calculating derived balance', async () => {
    const { balanceAccount } = await walletService.createWallet('user_rec_draft', 'IRR');

    // Create a draft transaction (unposted)
    const draftTx = LedgerTransaction.draft({
      id: 'tx_draft_1',
      description: 'Draft unposted transaction',
      entries: [
        new LedgerEntry({
          id: 'e_draft_1',
          accountId: balanceAccount.id,
          direction: EntryDirection.DEBIT,
          amount: Money.fromMinor('100000', 'IRR'),
        }),
        new LedgerEntry({
          id: 'e_draft_2',
          accountId: 'system-cash-account_irr',
          direction: EntryDirection.CREDIT,
          amount: Money.fromMinor('100000', 'IRR'),
        }),
      ],
    });

    await ledgerRepo.saveTransaction(draftTx);

    // Verify reconciliation remains healthy and ignores unposted draft entries
    const report = await reconciliationService.reconcile();
    expect(report.isHealthy).toBe(true);
    expect(report.balanceMismatches).toHaveLength(0);
  });

  it('detects balance projection mismatch when stored balance is corrupted', async () => {
    const { wallet, balanceAccount } = await walletService.createWallet('user_rec_2', 'IRR');

    await walletService.topUpWallet({
      walletId: wallet.id,
      amount: Money.fromMinor('50000', 'IRR'),
      reference: 'ref_topup_rec_1',
      idempotencyKey: 'idemp_topup_rec_1',
    });

    // Verify initially healthy
    let report = await reconciliationService.reconcile();
    expect(report.isHealthy).toBe(true);

    // Corrupt stored balance directly in database to test reconciliation detection
    await executor.query(`UPDATE ledger_accounts SET balance = 999999 WHERE id = $1`, [
      balanceAccount.id,
    ]);

    report = await reconciliationService.reconcile();
    expect(report.isHealthy).toBe(false);
    expect(report.balanceMismatches).toHaveLength(1);
    expect(report.balanceMismatches[0]!.accountId).toBe(balanceAccount.id);
    expect(report.balanceMismatches[0]!.storedBalance.amount).toBe(999999n);
    expect(report.balanceMismatches[0]!.ledgerDerivedBalance.amount).toBe(50000n);
  });
});
