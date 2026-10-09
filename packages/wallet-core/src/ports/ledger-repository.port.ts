import { AccountType, LedgerAccount, LedgerTransaction } from '../domain/ledger/index.js';
import { Money } from '../domain/money/index.js';

export interface ILedgerRepository {
  findAccountById(id: string): Promise<LedgerAccount | null>;
  findAccountByWalletIdAndType(walletId: string, type: AccountType): Promise<LedgerAccount | null>;
  findAccountsByWalletId(walletId: string): Promise<LedgerAccount[]>;
  saveAccount(account: LedgerAccount): Promise<LedgerAccount>;
  saveTransaction(transaction: LedgerTransaction): Promise<LedgerTransaction>;
  getTransactionById(id: string): Promise<LedgerTransaction | null>;
  getTransactionByIdempotencyKey(key: string): Promise<LedgerTransaction | null>;
  getAccountBalance(accountId: string): Promise<Money>;
}
