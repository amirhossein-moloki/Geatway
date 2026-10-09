import { Money } from '../domain/money/money.value-object.js';
import { LedgerTransaction } from '../domain/ledger/ledger-transaction.entity.js';
import { WalletService } from '../services/wallet.service.js';
import { Wallet } from '../domain/wallet/wallet.entity.js';

export interface WalletModuleServiceOptions {
  walletService: WalletService;
}

export class MedusaWalletModuleService {
  private readonly walletService: WalletService;

  constructor(options: WalletModuleServiceOptions) {
    this.walletService = options.walletService;
  }

  /**
   * Retrieves or creates a wallet for a given customer ID and currency.
   */
  public async getCustomerWallet(
    customerId: string,
    currency = 'IRR',
  ): Promise<{ wallet: Wallet; balance: Money }> {
    const uppercaseCurrency = currency.toUpperCase();
    const existingWallets = await this.walletService.getWalletsByOwnerId(customerId);
    let wallet = existingWallets.find((w) => w.currency === uppercaseCurrency);

    if (!wallet) {
      const created = await this.walletService.createWallet(customerId, uppercaseCurrency);
      wallet = created.wallet;
    }

    const balance = await this.walletService.getWalletBalance(wallet.id);
    return { wallet, balance };
  }

  /**
   * Returns current wallet balance for a wallet ID.
   */
  public async getWalletBalance(walletId: string): Promise<Money> {
    return this.walletService.getWalletBalance(walletId);
  }

  /**
   * Post a top-up credit to customer wallet following server-verified payment result.
   */
  public async topUpWallet(params: {
    walletId: string;
    amountMinor: bigint | number;
    currency: string;
    reference: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerTransaction> {
    const money = Money.fromMinor(BigInt(params.amountMinor), params.currency);
    return this.walletService.topUpWallet({
      walletId: params.walletId,
      amount: money,
      reference: params.reference,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }

  /**
   * Post authorized administrative credit to customer wallet.
   */
  public async adminCreditWallet(params: {
    walletId: string;
    amountMinor: bigint | number;
    currency: string;
    reason: string;
    adminId: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerTransaction> {
    const money = Money.fromMinor(BigInt(params.amountMinor), params.currency);
    return this.walletService.adminCreditWallet({
      walletId: params.walletId,
      amount: money,
      reason: params.reason,
      adminId: params.adminId,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }

  /**
   * Post authorized administrative debit from customer wallet.
   */
  public async adminDebitWallet(params: {
    walletId: string;
    amountMinor: bigint | number;
    currency: string;
    reason: string;
    adminId: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerTransaction> {
    const money = Money.fromMinor(BigInt(params.amountMinor), params.currency);
    return this.walletService.adminDebitWallet({
      walletId: params.walletId,
      amount: money,
      reason: params.reason,
      adminId: params.adminId,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }

  /**
   * Debits customer wallet for checkout payment.
   */
  public async debitForCheckout(params: {
    walletId: string;
    amountMinor: bigint | number;
    currency: string;
    orderId: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerTransaction> {
    const money = Money.fromMinor(BigInt(params.amountMinor), params.currency);
    return this.walletService.debitWalletForCheckout({
      walletId: params.walletId,
      amount: money,
      orderId: params.orderId,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }
}
