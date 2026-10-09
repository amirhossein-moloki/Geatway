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
  WalletService,
  MedusaWalletModuleService,
  MedusaWalletPaymentProvider,
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

describe('Medusa v2 Integration Adapters', () => {
  let walletRepo: InMemoryWalletRepo;
  let ledgerRepo: InMemoryLedgerRepo;
  let walletService: WalletService;
  let moduleService: MedusaWalletModuleService;
  let paymentProvider: MedusaWalletPaymentProvider;

  beforeEach(() => {
    walletRepo = new InMemoryWalletRepo();
    ledgerRepo = new InMemoryLedgerRepo();
    walletService = new WalletService({
      walletRepository: walletRepo,
      ledgerRepository: ledgerRepo,
    });
    moduleService = new MedusaWalletModuleService({ walletService });
    paymentProvider = new MedusaWalletPaymentProvider(walletService);
  });

  describe('MedusaWalletModuleService', () => {
    it('should provision customer wallet and retrieve balance', async () => {
      const { wallet, balance } = await moduleService.getCustomerWallet('cust_101', 'IRR');
      expect(wallet.ownerId).toBe('cust_101');
      expect(wallet.currency).toBe('IRR');
      expect(balance.amount).toBe(0n);

      const fetchedAgain = await moduleService.getCustomerWallet('cust_101', 'IRR');
      expect(fetchedAgain.wallet.id).toBe(wallet.id);
    });

    it('should top up customer wallet via module service', async () => {
      const { wallet } = await moduleService.getCustomerWallet('cust_102', 'IRR');

      const tx = await moduleService.topUpWallet({
        walletId: wallet.id,
        amountMinor: 250000n,
        currency: 'IRR',
        reference: 'topup_ref_102',
        idempotencyKey: 'idemp_topup_102',
      });

      expect(tx.status).toBe('POSTED');

      const balance = await moduleService.getWalletBalance(wallet.id);
      expect(balance.amount).toBe(250000n);
    });

    it('should admin credit and admin debit via module service', async () => {
      const { wallet } = await moduleService.getCustomerWallet('cust_103', 'IRR');

      await moduleService.adminCreditWallet({
        walletId: wallet.id,
        amountMinor: 500000n,
        currency: 'IRR',
        reason: 'VIP welcome gift',
        adminId: 'admin_01',
        idempotencyKey: 'idemp_adm_cred_103',
      });

      let balance = await moduleService.getWalletBalance(wallet.id);
      expect(balance.amount).toBe(500000n);

      await moduleService.adminDebitWallet({
        walletId: wallet.id,
        amountMinor: 100000n,
        currency: 'IRR',
        reason: 'Correction',
        adminId: 'admin_01',
        idempotencyKey: 'idemp_adm_deb_103',
      });

      balance = await moduleService.getWalletBalance(wallet.id);
      expect(balance.amount).toBe(400000n);
    });

    it('should debit for checkout via module service', async () => {
      const { wallet } = await moduleService.getCustomerWallet('cust_104', 'IRR');
      await moduleService.topUpWallet({
        walletId: wallet.id,
        amountMinor: 1000000n,
        currency: 'IRR',
        reference: 'ref_104',
        idempotencyKey: 'idemp_104',
      });

      const tx = await moduleService.debitForCheckout({
        walletId: wallet.id,
        amountMinor: 300000n,
        currency: 'IRR',
        orderId: 'order_104',
        idempotencyKey: 'idemp_chk_104',
      });

      expect(tx.reference).toBe('order_104');
      const balance = await moduleService.getWalletBalance(wallet.id);
      expect(balance.amount).toBe(700000n);
    });
  });

  describe('MedusaWalletPaymentProvider', () => {
    it('should initiate payment and check wallet balance', async () => {
      const { wallet } = await moduleService.getCustomerWallet('cust_201', 'IRR');
      await moduleService.topUpWallet({
        walletId: wallet.id,
        amountMinor: 500000n,
        currency: 'IRR',
        reference: 'topup_201',
        idempotencyKey: 'idemp_topup_201',
      });

      const initResult = await paymentProvider.initiatePayment({
        amount: 300000n,
        currency_code: 'IRR',
        customer_id: 'cust_201',
      });

      expect(initResult.status).toBe('pending');
      expect(initResult.data.walletId).toBe(wallet.id);
    });

    it('should return error on initiatePayment if wallet balance is insufficient', async () => {
      const { wallet } = await moduleService.getCustomerWallet('cust_202', 'IRR');

      const initResult = await paymentProvider.initiatePayment({
        amount: 500000n,
        currency_code: 'IRR',
        wallet_id: wallet.id,
      });

      expect(initResult.status).toBe('error');
      expect(initResult.error).toContain('Insufficient wallet balance');
    });

    it('should authorize payment by debiting wallet', async () => {
      const { wallet } = await moduleService.getCustomerWallet('cust_203', 'IRR');
      await moduleService.topUpWallet({
        walletId: wallet.id,
        amountMinor: 800000n,
        currency: 'IRR',
        reference: 'topup_203',
        idempotencyKey: 'idemp_topup_203',
      });

      const authResult = await paymentProvider.authorizePayment(
        {
          walletId: wallet.id,
          amount: '400000',
          currency: 'IRR',
        },
        'idemp_auth_203',
        'order_203',
      );

      expect(authResult.status).toBe('authorized');
      expect(authResult.data.transactionId).toBeDefined();

      const balance = await moduleService.getWalletBalance(wallet.id);
      expect(balance.amount).toBe(400000n);
    });

    it('should capture, cancel, and refund payment', async () => {
      const { wallet } = await moduleService.getCustomerWallet('cust_204', 'IRR');
      await moduleService.topUpWallet({
        walletId: wallet.id,
        amountMinor: 500000n,
        currency: 'IRR',
        reference: 'topup_204',
        idempotencyKey: 'idemp_topup_204',
      });

      await paymentProvider.authorizePayment(
        { walletId: wallet.id, amount: '200000', currency: 'IRR' },
        'idemp_auth_204',
        'order_204',
      );

      const captureResult = await paymentProvider.capturePayment({
        walletId: wallet.id,
        orderId: 'order_204',
      });
      expect(captureResult.status).toBe('captured');

      const refundResult = await paymentProvider.refundPayment(
        { walletId: wallet.id, currency: 'IRR', orderId: 'order_204' },
        100000n,
        'Item returned',
        'idemp_ref_204',
      );

      expect(refundResult.status).toBe('captured');
      expect(refundResult.data.refundTransactionId).toBeDefined();

      const balance = await moduleService.getWalletBalance(wallet.id);
      expect(balance.amount).toBe(400000n);
    });
  });
});
