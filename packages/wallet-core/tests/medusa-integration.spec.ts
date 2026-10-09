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

    it('rejects initiatePayment, authorizePayment, and refundPayment if wallet does not belong to customer', async () => {
      const { wallet: walletA } = await moduleService.getCustomerWallet('cust_alice', 'IRR');
      const { wallet: walletB } = await moduleService.getCustomerWallet('cust_bob', 'IRR');

      await moduleService.topUpWallet({
        walletId: walletA.id,
        amountMinor: 1000000n,
        currency: 'IRR',
        reference: 'topup_alice',
        idempotencyKey: 'idemp_topup_alice',
      });

      // 1. Initiate payment for Alice's wallet with Bob's customer ID
      const initRes = await paymentProvider.initiatePayment({
        amount: 500000n,
        currency_code: 'IRR',
        customer_id: 'cust_bob',
        wallet_id: walletA.id,
      });
      expect(initRes.status).toBe('error');
      expect(initRes.error).toContain("does not belong to customer 'cust_bob'");

      // 2. Authorize payment for Alice's wallet with Bob's customer ID
      const authRes = await paymentProvider.authorizePayment(
        {
          walletId: walletA.id,
          amount: '500000',
          currency: 'IRR',
          customerId: 'cust_bob',
        },
        'idemp_unauth_auth',
        'order_unauth_1',
      );
      expect(authRes.status).toBe('error');
      expect(authRes.error).toContain("does not belong to customer 'cust_bob'");

      // Confirm Alice's wallet balance remained unchanged (1,000,000)
      const balAlice = await moduleService.getWalletBalance(walletA.id);
      expect(balAlice.amount).toBe(1000000n);

      // 3. Refund payment for Alice's wallet with Bob's customer ID
      const refundRes = await paymentProvider.refundPayment(
        {
          walletId: walletA.id,
          currency: 'IRR',
          customerId: 'cust_bob',
        },
        100000n,
        'Unauthorized refund attempt',
        'idemp_unauth_ref',
      );
      expect(refundRes.status).toBe('error');
      expect(refundRes.error).toContain("does not belong to customer 'cust_bob'");
    });

    it('prevents duplicate debit on repeating authorizePayment with same idempotency key', async () => {
      const { wallet } = await moduleService.getCustomerWallet('cust_dup_auth', 'IRR');
      await moduleService.topUpWallet({
        walletId: wallet.id,
        amountMinor: 1000000n,
        currency: 'IRR',
        reference: 'topup_dup',
        idempotencyKey: 'idemp_topup_dup',
      });

      const sessionData = {
        walletId: wallet.id,
        amount: '300000',
        currency: 'IRR',
        customerId: 'cust_dup_auth',
      };

      // First authorization call
      const auth1 = await paymentProvider.authorizePayment(
        sessionData,
        'idemp_key_dup_auth_100',
        'order_dup_100',
      );
      expect(auth1.status).toBe('authorized');
      const txId1 = auth1.data.transactionId;

      const balAfterFirst = await moduleService.getWalletBalance(wallet.id);
      expect(balAfterFirst.amount).toBe(700000n);

      // Duplicate authorization call with same idempotency key
      const auth2 = await paymentProvider.authorizePayment(
        sessionData,
        'idemp_key_dup_auth_100',
        'order_dup_100',
      );
      expect(auth2.status).toBe('authorized');
      expect(auth2.data.transactionId).toBe(txId1);

      // Balance must NOT decrease a second time
      const balAfterSecond = await moduleService.getWalletBalance(wallet.id);
      expect(balAfterSecond.amount).toBe(700000n);
    });

    it('prevents duplicate credit on repeating refundPayment with same idempotency key', async () => {
      const { wallet } = await moduleService.getCustomerWallet('cust_dup_ref', 'IRR');
      await moduleService.topUpWallet({
        walletId: wallet.id,
        amountMinor: 500000n,
        currency: 'IRR',
        reference: 'topup_ref_dup',
        idempotencyKey: 'idemp_topup_ref_dup',
      });

      await paymentProvider.authorizePayment(
        { walletId: wallet.id, amount: '300000', currency: 'IRR', customerId: 'cust_dup_ref' },
        'idemp_auth_ref_dup',
        'order_ref_dup_1',
      );

      const paymentData = {
        walletId: wallet.id,
        currency: 'IRR',
        customerId: 'cust_dup_ref',
        orderId: 'order_ref_dup_1',
      };

      // First refund
      const ref1 = await paymentProvider.refundPayment(
        paymentData,
        100000n,
        'Partial refund',
        'idemp_key_dup_refund_200',
      );
      expect(ref1.status).toBe('captured');
      const refTx1 = ref1.data.refundTransactionId;

      const balAfterRef1 = await moduleService.getWalletBalance(wallet.id);
      expect(balAfterRef1.amount).toBe(300000n);

      // Duplicate refund with same idempotency key
      const ref2 = await paymentProvider.refundPayment(
        paymentData,
        100000n,
        'Partial refund retry',
        'idemp_key_dup_refund_200',
      );
      expect(ref2.status).toBe('captured');
      expect(ref2.data.refundTransactionId).toBe(refTx1);

      // Balance must NOT increase a second time
      const balAfterRef2 = await moduleService.getWalletBalance(wallet.id);
      expect(balAfterRef2.amount).toBe(300000n);
    });

    it('verifies double-entry ledger balance consistency (sum of debits == sum of credits) after checkout and refund', async () => {
      const { wallet } = await moduleService.getCustomerWallet('cust_ledger_check', 'IRR');

      await moduleService.topUpWallet({
        walletId: wallet.id,
        amountMinor: 1000000n,
        currency: 'IRR',
        reference: 'topup_ledger',
        idempotencyKey: 'idemp_topup_ledger',
      });

      await paymentProvider.authorizePayment(
        { walletId: wallet.id, amount: '400000', currency: 'IRR', customerId: 'cust_ledger_check' },
        'idemp_auth_ledger',
        'order_ledger_001',
      );

      await paymentProvider.refundPayment(
        { walletId: wallet.id, currency: 'IRR', customerId: 'cust_ledger_check' },
        150000n,
        'Partial refund',
        'idemp_ref_ledger',
      );

      // Audit all ledger transactions in ledgerRepo
      for (const tx of ledgerRepo.transactions.values()) {
        expect(() => tx.validate()).not.toThrow();
        const totals = tx.calculateTotals();
        expect(totals.debits.equals(totals.credits)).toBe(true);
      }

      const walletBal = await moduleService.getWalletBalance(wallet.id);
      // Initial: 0, TopUp: +1,000,000, Auth debit: -400,000, Refund credit: +150,000 = 750,000
      expect(walletBal.amount).toBe(750000n);
    });
  });
});
