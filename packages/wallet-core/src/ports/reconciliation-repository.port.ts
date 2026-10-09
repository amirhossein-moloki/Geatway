import { Money } from '../domain/money/money.value-object.js';

export interface UnbalancedTransactionDiscrepancy {
  transactionId: string;
  description: string;
  debits: Money;
  credits: Money;
  currency: string;
}

export interface BalanceProjectionMismatch {
  accountId: string;
  walletId?: string;
  storedBalance: Money;
  ledgerDerivedBalance: Money;
  currency: string;
  difference: Money;
}

export interface ReconciliationReport {
  timestamp: Date;
  isHealthy: boolean;
  unbalancedTransactions: UnbalancedTransactionDiscrepancy[];
  balanceMismatches: BalanceProjectionMismatch[];
}

export interface IReconciliationRepository {
  findUnbalancedTransactions(): Promise<UnbalancedTransactionDiscrepancy[]>;
  findBalanceMismatches(): Promise<BalanceProjectionMismatch[]>;
}
