import { describe, it, expect, beforeEach } from 'vitest';
import {
  WalletReconciliationService,
  IReconciliationRepository,
  Money,
} from '../src/index.js';

describe('WalletReconciliationService', () => {
  it('returns healthy report when no discrepancies exist', async () => {
    const mockRepo: IReconciliationRepository = {
      findUnbalancedTransactions: async () => [],
      findBalanceMismatches: async () => [],
    };

    const service = new WalletReconciliationService(mockRepo);
    const report = await service.reconcile();

    expect(report.isHealthy).toBe(true);
    expect(report.unbalancedTransactions).toHaveLength(0);
    expect(report.balanceMismatches).toHaveLength(0);
  });

  it('reports unbalanced transactions and balance mismatches', async () => {
    const mockRepo: IReconciliationRepository = {
      findUnbalancedTransactions: async () => [
        {
          transactionId: 'tx_corrupted_1',
          description: 'Corrupted transaction',
          debits: Money.fromMinor('1000', 'IRR'),
          credits: Money.fromMinor('500', 'IRR'),
          currency: 'IRR',
        },
      ],
      findBalanceMismatches: async () => [
        {
          accountId: 'acc_bal_wlt_1',
          walletId: 'wlt_1',
          storedBalance: Money.fromMinor('1000', 'IRR'),
          ledgerDerivedBalance: Money.fromMinor('500', 'IRR'),
          currency: 'IRR',
          difference: Money.fromMinor('500', 'IRR'),
        },
      ],
    };

    const service = new WalletReconciliationService(mockRepo);
    const report = await service.reconcile();

    expect(report.isHealthy).toBe(false);
    expect(report.unbalancedTransactions).toHaveLength(1);
    expect(report.unbalancedTransactions[0]!.transactionId).toBe('tx_corrupted_1');
    expect(report.balanceMismatches).toHaveLength(1);
    expect(report.balanceMismatches[0]!.accountId).toBe('acc_bal_wlt_1');
  });
});
