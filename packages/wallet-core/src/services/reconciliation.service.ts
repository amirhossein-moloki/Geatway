import {
  IReconciliationRepository,
  ReconciliationReport,
} from '../ports/reconciliation-repository.port.js';

export class WalletReconciliationService {
  constructor(private readonly reconciliationRepo: IReconciliationRepository) {}

  /**
   * Safe, read-only reconciliation run that detects:
   * 1. Unbalanced posted ledger transactions (sum of debits != sum of credits).
   * 2. Mismatches between stored account balance projections and sum of ledger entries.
   *
   * Re-runnable without making automated un-audited state changes.
   */
  public async reconcile(): Promise<ReconciliationReport> {
    const unbalancedTransactions = await this.reconciliationRepo.findUnbalancedTransactions();
    const balanceMismatches = await this.reconciliationRepo.findBalanceMismatches();

    const isHealthy = unbalancedTransactions.length === 0 && balanceMismatches.length === 0;

    return {
      timestamp: new Date(),
      isHealthy,
      unbalancedTransactions,
      balanceMismatches,
    };
  }
}
