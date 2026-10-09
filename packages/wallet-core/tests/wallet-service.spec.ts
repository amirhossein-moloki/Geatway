import { describe, it, expect, beforeEach } from 'vitest';
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
  WalletError,
  WalletFrozenError,
  CurrencyMismatchError,
  InvalidAmountError,
  WalletService,
} from '../src/index.js';

class InMemoryWalletRepo implements IWalletRepository {
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

class InMemoryLedgerRepo implements ILedgerRepository {
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
    if (transaction.idempotencyKey) {
      const existing = this.idempotencyMap.get(transaction.idempotencyKey);
      if (existing) {
        return existing;
      }
    }
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

describe('WalletService Domain Integration', () => {
  let walletRepo: InMemoryWalletRepo;
  let ledgerRepo: InMemoryLedgerRepo;
  let service: WalletService;

  beforeEach(() => {
    walletRepo = new InMemoryWalletRepo();
    ledgerRepo = new InMemoryLedgerRepo();
    service = new WalletService({
      walletRepository: walletRepo,
      ledgerRepository: ledgerRepo,
    });
  });

  describe('Wallet Creation & Retrieval', () => {
    it('should create a wallet and auto-provision a liability ledger account', async () => {
      const { wallet, balanceAccount } = await service.createWallet('user_100', 'IRR');

      expect(wallet.ownerId).toBe('user_100');
      expect(wallet.currency).toBe('IRR');
      expect(wallet.status).toBe(WalletStatus.ACTIVE);

      expect(balanceAccount.walletId).toBe(wallet.id);
      expect(balanceAccount.type).toBe(AccountType.LIABILITY);
      expect(balanceAccount.currency).toBe('IRR');

      const initialBalance = await service.getWalletBalance(wallet.id);
      expect(initialBalance.amount).toBe(0n);
      expect(initialBalance.currency).toBe('IRR');
    });

    it('should return existing wallet if created again for same owner and currency', async () => {
      const created1 = await service.createWallet('user_100', 'IRR');
      const created2 = await service.createWallet('user_100', 'IRR');

      expect(created1.wallet.id).toBe(created2.wallet.id);
    });

    it('should reject empty owner ID', async () => {
      await expect(service.createWallet('   ', 'IRR')).rejects.toThrow(WalletError);
    });
  });

  describe('Wallet Top-Up', () => {
    it('should credit wallet and update balance using double-entry ledger entries', async () => {
      const { wallet } = await service.createWallet('user_101', 'IRR');
      const amount = Money.fromMinor(500000n, 'IRR');

      const tx = await service.topUpWallet({
        walletId: wallet.id,
        amount,
        reference: 'ref_topup_001',
        idempotencyKey: 'idemp_topup_001',
      });

      expect(tx.status).toBe('POSTED');
      expect(tx.entries).toHaveLength(2);

      const newBalance = await service.getWalletBalance(wallet.id);
      expect(newBalance.amount).toBe(500000n);
    });

    it('should enforce idempotency on top-up requests', async () => {
      const { wallet } = await service.createWallet('user_102', 'IRR');
      const amount = Money.fromMinor(300000n, 'IRR');

      const tx1 = await service.topUpWallet({
        walletId: wallet.id,
        amount,
        reference: 'ref_topup_002',
        idempotencyKey: 'idemp_dup_key',
      });

      const tx2 = await service.topUpWallet({
        walletId: wallet.id,
        amount,
        reference: 'ref_topup_002',
        idempotencyKey: 'idemp_dup_key',
      });

      expect(tx1.id).toBe(tx2.id);
      const balance = await service.getWalletBalance(wallet.id);
      expect(balance.amount).toBe(300000n);
    });

    it('should reject top-up with zero or negative amount', async () => {
      const { wallet } = await service.createWallet('user_102_neg', 'IRR');

      await expect(
        service.topUpWallet({
          walletId: wallet.id,
          amount: Money.fromMinor(0n, 'IRR'),
          reference: 'ref_zero',
          idempotencyKey: 'idemp_zero',
        }),
      ).rejects.toThrow(InvalidAmountError);

      await expect(
        service.topUpWallet({
          walletId: wallet.id,
          amount: Money.fromMinor(-500n, 'IRR'),
          reference: 'ref_neg',
          idempotencyKey: 'idemp_neg',
        }),
      ).rejects.toThrow(InvalidAmountError);
    });

    it('should reject top-up with mismatched currency', async () => {
      const { wallet } = await service.createWallet('user_103', 'IRR');
      const amountUsd = Money.fromMinor(100n, 'USD');

      await expect(
        service.topUpWallet({
          walletId: wallet.id,
          amount: amountUsd,
          reference: 'ref_topup_usd',
          idempotencyKey: 'idemp_usd',
        }),
      ).rejects.toThrow(CurrencyMismatchError);
    });
  });

  describe('Administrative Operations (Credit / Debit)', () => {
    it('should perform authorized administrative credit with audit metadata', async () => {
      const { wallet } = await service.createWallet('user_200', 'IRR');
      const creditAmount = Money.fromMinor(200000n, 'IRR');

      const tx = await service.adminCreditWallet({
        walletId: wallet.id,
        amount: creditAmount,
        reason: 'Compensation for system downtime',
        adminId: 'admin_jack',
        idempotencyKey: 'idemp_adm_cred_1',
      });

      expect(tx.status).toBe('POSTED');
      expect(tx.metadata?.adminId).toBe('admin_jack');
      expect(tx.metadata?.reason).toBe('Compensation for system downtime');

      const balance = await service.getWalletBalance(wallet.id);
      expect(balance.amount).toBe(200000n);
    });

    it('should perform authorized administrative debit when balance is sufficient', async () => {
      const { wallet } = await service.createWallet('user_201', 'IRR');
      await service.topUpWallet({
        walletId: wallet.id,
        amount: Money.fromMinor(500000n, 'IRR'),
        reference: 'ref_init',
        idempotencyKey: 'idemp_init',
      });

      const debitAmount = Money.fromMinor(150000n, 'IRR');
      const tx = await service.adminDebitWallet({
        walletId: wallet.id,
        amount: debitAmount,
        reason: 'Correction for over-credit',
        adminId: 'admin_mary',
        idempotencyKey: 'idemp_adm_deb_1',
      });

      expect(tx.status).toBe('POSTED');
      const balance = await service.getWalletBalance(wallet.id);
      expect(balance.amount).toBe(350000n);
    });

    it('should reject administrative debit if adminId or reason is missing', async () => {
      const { wallet } = await service.createWallet('user_202', 'IRR');

      await expect(
        service.adminDebitWallet({
          walletId: wallet.id,
          amount: Money.fromMinor(100n, 'IRR'),
          reason: '',
          adminId: 'admin_1',
          idempotencyKey: 'key_1',
        }),
      ).rejects.toThrow(WalletError);

      await expect(
        service.adminDebitWallet({
          walletId: wallet.id,
          amount: Money.fromMinor(100n, 'IRR'),
          reason: 'Valid reason',
          adminId: '',
          idempotencyKey: 'key_2',
        }),
      ).rejects.toThrow(WalletError);
    });
  });

  describe('Checkout Wallet Debit', () => {
    it('should debit wallet balance for checkout and credit revenue account', async () => {
      const { wallet } = await service.createWallet('user_300', 'IRR');
      await service.topUpWallet({
        walletId: wallet.id,
        amount: Money.fromMinor(1000000n, 'IRR'),
        reference: 'topup_order_prep',
        idempotencyKey: 'idemp_prep',
      });

      const orderAmount = Money.fromMinor(400000n, 'IRR');
      const tx = await service.debitWalletForCheckout({
        walletId: wallet.id,
        amount: orderAmount,
        orderId: 'order_9988',
        idempotencyKey: 'idemp_chk_9988',
      });

      expect(tx.status).toBe('POSTED');
      expect(tx.reference).toBe('order_9988');

      const remainingBalance = await service.getWalletBalance(wallet.id);
      expect(remainingBalance.amount).toBe(600000n);
    });

    it('should reject checkout debit if balance is insufficient', async () => {
      const { wallet } = await service.createWallet('user_301', 'IRR');
      await service.topUpWallet({
        walletId: wallet.id,
        amount: Money.fromMinor(100000n, 'IRR'),
        reference: 'topup_small',
        idempotencyKey: 'idemp_small',
      });

      const expensiveOrder = Money.fromMinor(500000n, 'IRR');
      await expect(
        service.debitWalletForCheckout({
          walletId: wallet.id,
          amount: expensiveOrder,
          orderId: 'order_expensive',
          idempotencyKey: 'idemp_exp',
        }),
      ).rejects.toThrow(/Insufficient wallet balance/);
    });

    it('should reject transactions on frozen wallets', async () => {
      const { wallet } = await service.createWallet('user_302', 'IRR');
      wallet.freeze('Fraud suspicion');
      await walletRepo.save(wallet);

      await expect(
        service.topUpWallet({
          walletId: wallet.id,
          amount: Money.fromMinor(100000n, 'IRR'),
          reference: 'ref_frozen',
          idempotencyKey: 'idemp_frozen',
        }),
      ).rejects.toThrow(WalletFrozenError);
    });
  });
});
