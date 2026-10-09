import {
  AccountType,
  EntryDirection,
  IWalletRepository,
  ILedgerRepository,
  LedgerAccount,
  LedgerTransaction,
  Money,
  Wallet,
  WalletStatus,
} from '@amirhossein-moloki/wallet-core';

export class InMemoryWalletRepository implements IWalletRepository {
  public wallets: Map<string, Wallet> = new Map();

  public async findById(id: string): Promise<Wallet | null> {
    return this.wallets.get(id) ?? null;
  }

  public async findByOwnerId(ownerId: string): Promise<Wallet[]> {
    return Array.from(this.wallets.values()).filter((w) => w.ownerId === ownerId);
  }

  public async save(wallet: Wallet): Promise<Wallet> {
    this.wallets.set(wallet.id, wallet);
    return wallet;
  }

  public async updateStatus(id: string, status: WalletStatus): Promise<void> {
    const w = this.wallets.get(id);
    if (w) {
      if (status === WalletStatus.FROZEN) w.freeze();
      else if (status === WalletStatus.CLOSED) w.close();
      else if (status === WalletStatus.ACTIVE) w.unfreeze();
    }
  }
}

export class InMemoryLedgerRepository implements ILedgerRepository {
  public accounts: Map<string, LedgerAccount> = new Map();
  public transactions: Map<string, LedgerTransaction> = new Map();
  public idempotencyMap: Map<string, LedgerTransaction> = new Map();

  public async findAccountById(id: string): Promise<LedgerAccount | null> {
    return this.accounts.get(id) ?? null;
  }

  public async findAccountByWalletIdAndType(
    walletId: string,
    type: AccountType,
  ): Promise<LedgerAccount | null> {
    return (
      Array.from(this.accounts.values()).find(
        (acc) => acc.walletId === walletId && acc.type === type,
      ) ?? null
    );
  }

  public async findAccountsByWalletId(walletId: string): Promise<LedgerAccount[]> {
    return Array.from(this.accounts.values()).filter((acc) => acc.walletId === walletId);
  }

  public async saveAccount(account: LedgerAccount): Promise<LedgerAccount> {
    this.accounts.set(account.id, account);
    return account;
  }

  public async saveTransaction(transaction: LedgerTransaction): Promise<LedgerTransaction> {
    this.transactions.set(transaction.id, transaction);
    if (transaction.idempotencyKey) {
      this.idempotencyMap.set(transaction.idempotencyKey, transaction);
    }
    return transaction;
  }

  public async getTransactionById(id: string): Promise<LedgerTransaction | null> {
    return this.transactions.get(id) ?? null;
  }

  public async getTransactionByIdempotencyKey(key: string): Promise<LedgerTransaction | null> {
    return this.idempotencyMap.get(key) ?? null;
  }

  public async getAccountBalance(accountId: string): Promise<Money> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    let debits = Money.zero(account.currency);
    let credits = Money.zero(account.currency);

    for (const tx of this.transactions.values()) {
      if (tx.status !== 'POSTED') continue;
      for (const entry of tx.entries) {
        if (entry.accountId === accountId) {
          if (entry.direction === EntryDirection.DEBIT) {
            debits = debits.add(entry.amount);
          } else if (entry.direction === EntryDirection.CREDIT) {
            credits = credits.add(entry.amount);
          }
        }
      }
    }

    return account.calculateBalance(debits, credits);
  }
}
