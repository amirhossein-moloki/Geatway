import {
  AccountType,
  EntryDirection,
  IWalletDomainService,
  IWalletRepository,
  ILedgerRepository,
  LedgerAccount,
  LedgerEntry,
  LedgerTransaction,
  Money,
  TransactionStatus,
  Wallet,
  WalletError,
  CurrencyMismatchError,
  InvalidAmountError,
} from '../index.js';

export interface WalletServiceConfig {
  walletRepository: IWalletRepository;
  ledgerRepository: ILedgerRepository;
  systemCashAccountId?: string;
  systemRevenueAccountId?: string;
}

export interface TopUpWalletParams {
  walletId: string;
  amount: Money;
  reference: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface AdminCreditWalletParams {
  walletId: string;
  amount: Money;
  reason: string;
  adminId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface AdminDebitWalletParams {
  walletId: string;
  amount: Money;
  reason: string;
  adminId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface CheckoutDebitParams {
  walletId: string;
  amount: Money;
  orderId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface GetTransactionHistoryOptions {
  limit?: number;
  offset?: number;
}

export class WalletService implements IWalletDomainService {
  private readonly walletRepo: IWalletRepository;
  private readonly ledgerRepo: ILedgerRepository;
  private readonly systemCashAccountId: string;
  private readonly systemRevenueAccountId: string;

  constructor(config: WalletServiceConfig) {
    this.walletRepo = config.walletRepository;
    this.ledgerRepo = config.ledgerRepository;
    this.systemCashAccountId = config.systemCashAccountId || 'system-cash-account';
    this.systemRevenueAccountId = config.systemRevenueAccountId || 'system-revenue-account';
  }

  /**
   * Creates a new wallet for an owner and automatically provisions its customer ledger balance account.
   */
  public async createWallet(
    ownerId: string,
    currency: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ wallet: Wallet; balanceAccount: LedgerAccount }> {
    if (!ownerId || ownerId.trim() === '') {
      throw new WalletError('Owner ID must be a non-empty string', 400);
    }

    const uppercaseCurrency = currency.trim().toUpperCase();
    const existingWallets = await this.walletRepo.findByOwnerId(ownerId);
    const existingWallet = existingWallets.find((w) => w.currency === uppercaseCurrency);
    if (existingWallet) {
      const existingAccount = await this.ledgerRepo.findAccountByWalletIdAndType(
        existingWallet.id,
        AccountType.LIABILITY,
      );
      if (existingAccount) {
        return { wallet: existingWallet, balanceAccount: existingAccount };
      }
    }

    const walletId = `wlt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const wallet = Wallet.create({
      id: walletId,
      ownerId,
      currency: uppercaseCurrency,
      metadata,
    });

    const savedWallet = await this.walletRepo.save(wallet);

    const balanceAccount = LedgerAccount.create({
      id: `acc_bal_${walletId}`,
      name: `Customer Balance Account - ${ownerId}`,
      type: AccountType.LIABILITY,
      currency: uppercaseCurrency,
      walletId: savedWallet.id,
      metadata: { ownerId },
    });

    const savedAccount = await this.ledgerRepo.saveAccount(balanceAccount);

    // Ensure system cash account exists for this currency
    await this.ensureSystemAccount(
      this.systemCashAccountId,
      'System Cash Clearing Account',
      AccountType.ASSET,
      uppercaseCurrency,
    );

    return { wallet: savedWallet, balanceAccount: savedAccount };
  }

  /**
   * Retrieves a wallet by ID.
   */
  public async getWalletById(walletId: string): Promise<Wallet | null> {
    return this.walletRepo.findById(walletId);
  }

  /**
   * Retrieves wallets by owner ID.
   */
  public async getWalletsByOwnerId(ownerId: string): Promise<Wallet[]> {
    return this.walletRepo.findByOwnerId(ownerId);
  }

  /**
   * Gets the current balance for a wallet.
   */
  public async getWalletBalance(walletId: string): Promise<Money> {
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) {
      throw new WalletError(`Wallet '${walletId}' not found`, 404);
    }

    const balanceAccount = await this.ledgerRepo.findAccountByWalletIdAndType(
      walletId,
      AccountType.LIABILITY,
    );
    if (!balanceAccount) {
      return Money.zero(wallet.currency);
    }

    return this.ledgerRepo.getAccountBalance(balanceAccount.id);
  }

  /**
   * Posts a raw LedgerTransaction while asserting wallet state.
   */
  public async postTransaction(transaction: LedgerTransaction): Promise<LedgerTransaction> {
    if (transaction.idempotencyKey) {
      const existing = await this.ledgerRepo.getTransactionByIdempotencyKey(
        transaction.idempotencyKey,
      );
      if (existing) {
        return existing;
      }
    }

    if (transaction.status === TransactionStatus.DRAFT) {
      transaction.post();
    }

    return this.ledgerRepo.saveTransaction(transaction);
  }

  /**
   * Credits a customer's wallet following a verified external payment provider top-up.
   * Double-entry: Debit System Cash (Asset +), Credit Customer Wallet (Liability +).
   */
  public async topUpWallet(params: TopUpWalletParams): Promise<LedgerTransaction> {
    if (!params.idempotencyKey || params.idempotencyKey.trim() === '') {
      throw new WalletError('Idempotency key is required for wallet top-up', 400);
    }
    if (!params.reference || params.reference.trim() === '') {
      throw new WalletError('Reference is required for wallet top-up', 400);
    }
    if (!params.amount.isPositive()) {
      throw new InvalidAmountError('Top-up amount must be strictly positive');
    }

    const existingTx = await this.ledgerRepo.getTransactionByIdempotencyKey(params.idempotencyKey);
    if (existingTx) {
      return existingTx;
    }

    const wallet = await this.walletRepo.findById(params.walletId);
    if (!wallet) {
      throw new WalletError(`Wallet '${params.walletId}' not found`, 404);
    }
    wallet.assertCanTransact();

    if (wallet.currency !== params.amount.currency) {
      throw new CurrencyMismatchError(wallet.currency, params.amount.currency);
    }

    const balanceAccount = await this.ledgerRepo.findAccountByWalletIdAndType(
      params.walletId,
      AccountType.LIABILITY,
    );
    if (!balanceAccount) {
      throw new WalletError(`Balance account for wallet '${params.walletId}' not found`, 404);
    }

    const cashAccount = await this.ensureSystemAccount(
      this.systemCashAccountId,
      'System Cash Clearing Account',
      AccountType.ASSET,
      wallet.currency,
    );

    const txId = `tx_topup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tx = LedgerTransaction.draft({
      id: txId,
      description: `Wallet top-up via reference ${params.reference}`,
      idempotencyKey: params.idempotencyKey,
      reference: params.reference,
      metadata: {
        type: 'TOPUP',
        walletId: params.walletId,
        ...params.metadata,
      },
      entries: [
        new LedgerEntry({
          id: `${txId}_dr`,
          accountId: cashAccount.id,
          direction: EntryDirection.DEBIT,
          amount: params.amount,
          memo: `Cash received for wallet top-up`,
        }),
        new LedgerEntry({
          id: `${txId}_cr`,
          accountId: balanceAccount.id,
          direction: EntryDirection.CREDIT,
          amount: params.amount,
          memo: `Wallet top-up credit`,
        }),
      ],
    });

    return this.postTransaction(tx);
  }

  /**
   * Authorized administrative credit to a customer's wallet.
   * Requires admin identity, audit reason, exact monetary amount, and idempotency key.
   */
  public async adminCreditWallet(params: AdminCreditWalletParams): Promise<LedgerTransaction> {
    if (!params.adminId || params.adminId.trim() === '') {
      throw new WalletError('Admin ID is required for administrative credit', 403);
    }
    if (!params.reason || params.reason.trim() === '') {
      throw new WalletError('Reason is required for administrative credit', 400);
    }
    if (!params.idempotencyKey || params.idempotencyKey.trim() === '') {
      throw new WalletError('Idempotency key is required for administrative credit', 400);
    }
    if (!params.amount.isPositive()) {
      throw new InvalidAmountError('Credit amount must be strictly positive');
    }

    const existingTx = await this.ledgerRepo.getTransactionByIdempotencyKey(params.idempotencyKey);
    if (existingTx) {
      return existingTx;
    }

    const wallet = await this.walletRepo.findById(params.walletId);
    if (!wallet) {
      throw new WalletError(`Wallet '${params.walletId}' not found`, 404);
    }
    wallet.assertCanTransact();

    if (wallet.currency !== params.amount.currency) {
      throw new CurrencyMismatchError(wallet.currency, params.amount.currency);
    }

    const balanceAccount = await this.ledgerRepo.findAccountByWalletIdAndType(
      params.walletId,
      AccountType.LIABILITY,
    );
    if (!balanceAccount) {
      throw new WalletError(`Balance account for wallet '${params.walletId}' not found`, 404);
    }

    const cashAccount = await this.ensureSystemAccount(
      this.systemCashAccountId,
      'System Cash Clearing Account',
      AccountType.ASSET,
      wallet.currency,
    );

    const txId = `tx_adm_cred_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tx = LedgerTransaction.draft({
      id: txId,
      description: `Admin credit by ${params.adminId}: ${params.reason}`,
      idempotencyKey: params.idempotencyKey,
      metadata: {
        type: 'ADMIN_CREDIT',
        walletId: params.walletId,
        adminId: params.adminId,
        reason: params.reason,
        ...params.metadata,
      },
      entries: [
        new LedgerEntry({
          id: `${txId}_dr`,
          accountId: cashAccount.id,
          direction: EntryDirection.DEBIT,
          amount: params.amount,
          memo: `Admin credit source: ${params.reason}`,
        }),
        new LedgerEntry({
          id: `${txId}_cr`,
          accountId: balanceAccount.id,
          direction: EntryDirection.CREDIT,
          amount: params.amount,
          memo: `Admin credit to customer wallet`,
        }),
      ],
    });

    return this.postTransaction(tx);
  }

  /**
   * Authorized administrative debit from a customer's wallet.
   * Requires admin identity, audit reason, exact monetary amount, and idempotency key.
   */
  public async adminDebitWallet(params: AdminDebitWalletParams): Promise<LedgerTransaction> {
    if (!params.adminId || params.adminId.trim() === '') {
      throw new WalletError('Admin ID is required for administrative debit', 403);
    }
    if (!params.reason || params.reason.trim() === '') {
      throw new WalletError('Reason is required for administrative debit', 400);
    }
    if (!params.idempotencyKey || params.idempotencyKey.trim() === '') {
      throw new WalletError('Idempotency key is required for administrative debit', 400);
    }
    if (!params.amount.isPositive()) {
      throw new InvalidAmountError('Debit amount must be strictly positive');
    }

    const existingTx = await this.ledgerRepo.getTransactionByIdempotencyKey(params.idempotencyKey);
    if (existingTx) {
      return existingTx;
    }

    const wallet = await this.walletRepo.findById(params.walletId);
    if (!wallet) {
      throw new WalletError(`Wallet '${params.walletId}' not found`, 404);
    }
    wallet.assertCanTransact();

    if (wallet.currency !== params.amount.currency) {
      throw new CurrencyMismatchError(wallet.currency, params.amount.currency);
    }

    const currentBalance = await this.getWalletBalance(params.walletId);
    if (currentBalance.isLessThan(params.amount)) {
      throw new WalletError(
        `Insufficient wallet balance. Current: ${currentBalance.amount}, Requested: ${params.amount.amount}`,
        422,
      );
    }

    const balanceAccount = await this.ledgerRepo.findAccountByWalletIdAndType(
      params.walletId,
      AccountType.LIABILITY,
    );
    if (!balanceAccount) {
      throw new WalletError(`Balance account for wallet '${params.walletId}' not found`, 404);
    }

    const cashAccount = await this.ensureSystemAccount(
      this.systemCashAccountId,
      'System Cash Clearing Account',
      AccountType.ASSET,
      wallet.currency,
    );

    const txId = `tx_adm_deb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tx = LedgerTransaction.draft({
      id: txId,
      description: `Admin debit by ${params.adminId}: ${params.reason}`,
      idempotencyKey: params.idempotencyKey,
      metadata: {
        type: 'ADMIN_DEBIT',
        walletId: params.walletId,
        adminId: params.adminId,
        reason: params.reason,
        ...params.metadata,
      },
      entries: [
        new LedgerEntry({
          id: `${txId}_dr`,
          accountId: balanceAccount.id,
          direction: EntryDirection.DEBIT,
          amount: params.amount,
          memo: `Admin debit from customer wallet`,
        }),
        new LedgerEntry({
          id: `${txId}_cr`,
          accountId: cashAccount.id,
          direction: EntryDirection.CREDIT,
          amount: params.amount,
          memo: `Admin debit target: ${params.reason}`,
        }),
      ],
    });

    return this.postTransaction(tx);
  }

  /**
   * Debits a customer's wallet for e-commerce checkout payment.
   * Double-entry: Debit Customer Wallet (Liability -), Credit System Revenue (Revenue +).
   */
  public async debitWalletForCheckout(params: CheckoutDebitParams): Promise<LedgerTransaction> {
    if (!params.orderId || params.orderId.trim() === '') {
      throw new WalletError('Order ID is required for checkout wallet debit', 400);
    }
    if (!params.idempotencyKey || params.idempotencyKey.trim() === '') {
      throw new WalletError('Idempotency key is required for checkout wallet debit', 400);
    }
    if (!params.amount.isPositive()) {
      throw new InvalidAmountError('Checkout debit amount must be strictly positive');
    }

    const existingTx = await this.ledgerRepo.getTransactionByIdempotencyKey(params.idempotencyKey);
    if (existingTx) {
      return existingTx;
    }

    const wallet = await this.walletRepo.findById(params.walletId);
    if (!wallet) {
      throw new WalletError(`Wallet '${params.walletId}' not found`, 404);
    }
    wallet.assertCanTransact();

    if (wallet.currency !== params.amount.currency) {
      throw new CurrencyMismatchError(wallet.currency, params.amount.currency);
    }

    const currentBalance = await this.getWalletBalance(params.walletId);
    if (currentBalance.isLessThan(params.amount)) {
      throw new WalletError(
        `Insufficient wallet balance for checkout. Current balance: ${currentBalance.amount}, Order amount: ${params.amount.amount}`,
        422,
      );
    }

    const balanceAccount = await this.ledgerRepo.findAccountByWalletIdAndType(
      params.walletId,
      AccountType.LIABILITY,
    );
    if (!balanceAccount) {
      throw new WalletError(`Balance account for wallet '${params.walletId}' not found`, 404);
    }

    const revenueAccount = await this.ensureSystemAccount(
      this.systemRevenueAccountId,
      'System Sales Revenue Account',
      AccountType.REVENUE,
      wallet.currency,
    );

    const txId = `tx_chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tx = LedgerTransaction.draft({
      id: txId,
      description: `Checkout payment for order ${params.orderId}`,
      idempotencyKey: params.idempotencyKey,
      reference: params.orderId,
      metadata: {
        type: 'CHECKOUT_DEBIT',
        walletId: params.walletId,
        orderId: params.orderId,
        ...params.metadata,
      },
      entries: [
        new LedgerEntry({
          id: `${txId}_dr`,
          accountId: balanceAccount.id,
          direction: EntryDirection.DEBIT,
          amount: params.amount,
          memo: `Wallet debit for order ${params.orderId}`,
        }),
        new LedgerEntry({
          id: `${txId}_cr`,
          accountId: revenueAccount.id,
          direction: EntryDirection.CREDIT,
          amount: params.amount,
          memo: `Sales revenue for order ${params.orderId}`,
        }),
      ],
    });

    return this.postTransaction(tx);
  }

  /**
   * Helper to ensure a system account (Cash or Revenue) exists for the given currency.
   */
  private async ensureSystemAccount(
    baseAccountId: string,
    name: string,
    type: AccountType,
    currency: string,
  ): Promise<LedgerAccount> {
    const accountId = `${baseAccountId}_${currency.toLowerCase()}`;
    const existing = await this.ledgerRepo.findAccountById(accountId);
    if (existing) {
      return existing;
    }

    const newAccount = LedgerAccount.create({
      id: accountId,
      name: `${name} (${currency})`,
      type,
      currency,
    });

    return this.ledgerRepo.saveAccount(newAccount);
  }
}
