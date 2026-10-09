import { LedgerAccount, LedgerTransaction } from '../domain/ledger/index.js';
import { Money } from '../domain/money/index.js';
import { Wallet } from '../domain/wallet/index.js';

export interface IWalletDomainService {
  createWallet(
    ownerId: string,
    currency: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ wallet: Wallet; balanceAccount: LedgerAccount }>;

  postTransaction(transaction: LedgerTransaction): Promise<LedgerTransaction>;

  getWalletBalance(walletId: string): Promise<Money>;
}
