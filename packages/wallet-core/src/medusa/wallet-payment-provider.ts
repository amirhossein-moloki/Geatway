import { Money } from '../domain/money/money.value-object.js';
import { WalletService } from '../services/wallet.service.js';

export interface InitiatePaymentContext {
  amount: number | bigint;
  currency_code: string;
  customer_id?: string;
  wallet_id?: string;
  context?: Record<string, unknown>;
}

export interface AuthorizePaymentContext {
  paymentSessionData: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface PaymentProviderResult {
  status: 'authorized' | 'captured' | 'pending' | 'error' | 'canceled' | 'requires_more';
  data: Record<string, unknown>;
  error?: string;
}

export class MedusaWalletPaymentProvider {
  public static readonly PROVIDER_ID = 'pp_wallet';
  public readonly identifier = MedusaWalletPaymentProvider.PROVIDER_ID;

  private readonly walletService: WalletService;

  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  /**
   * Initiates payment by checking wallet balance.
   */
  public async initiatePayment(input: InitiatePaymentContext): Promise<PaymentProviderResult> {
    const currency = input.currency_code.toUpperCase();
    const amountMoney = Money.fromMinor(BigInt(input.amount), currency);

    let walletId = input.wallet_id;
    if (!walletId && input.customer_id) {
      const wallets = await this.walletService.getWalletsByOwnerId(input.customer_id);
      const target = wallets.find((w) => w.currency === currency);
      if (target) {
        walletId = target.id;
      }
    }

    if (!walletId) {
      return {
        status: 'error',
        data: {},
        error: `No wallet found for currency ${currency}`,
      };
    }

    const currentBalance = await this.walletService.getWalletBalance(walletId);
    if (currentBalance.isLessThan(amountMoney)) {
      return {
        status: 'error',
        data: {
          walletId,
          requiredAmount: amountMoney.amount.toString(),
          currentBalance: currentBalance.amount.toString(),
        },
        error: `Insufficient wallet balance. Current: ${currentBalance.amount}, Required: ${amountMoney.amount}`,
      };
    }

    return {
      status: 'pending',
      data: {
        walletId,
        amount: amountMoney.amount.toString(),
        currency,
        customerId: input.customer_id,
      },
    };
  }

  /**
   * Authorizes payment by executing double-entry ledger debit for checkout.
   */
  public async authorizePayment(
    paymentSessionData: Record<string, unknown>,
    idempotencyKey: string,
    orderId: string,
  ): Promise<PaymentProviderResult> {
    const walletId = paymentSessionData.walletId as string;
    const amountStr = paymentSessionData.amount as string;
    const currency = paymentSessionData.currency as string;

    if (!walletId || !amountStr || !currency) {
      return {
        status: 'error',
        data: paymentSessionData,
        error: 'Invalid payment session data for wallet checkout',
      };
    }

    try {
      const amount = Money.fromMinor(BigInt(amountStr), currency);
      const tx = await this.walletService.debitWalletForCheckout({
        walletId,
        amount,
        orderId,
        idempotencyKey,
      });

      return {
        status: 'authorized',
        data: {
          ...paymentSessionData,
          transactionId: tx.id,
          orderId,
          idempotencyKey,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'error',
        data: paymentSessionData,
        error: message,
      };
    }
  }

  /**
   * Captures payment. Since debit occurs during authorization, capture confirms payment state.
   */
  public async capturePayment(
    paymentData: Record<string, unknown>,
  ): Promise<PaymentProviderResult> {
    return {
      status: 'captured',
      data: {
        ...paymentData,
        capturedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Cancels payment.
   */
  public async cancelPayment(paymentData: Record<string, unknown>): Promise<PaymentProviderResult> {
    return {
      status: 'canceled',
      data: {
        ...paymentData,
        canceledAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Refunds payment by crediting customer wallet via administrative/system refund.
   */
  public async refundPayment(
    paymentData: Record<string, unknown>,
    refundAmountMinor: bigint | number,
    reason: string,
    idempotencyKey: string,
  ): Promise<PaymentProviderResult> {
    const walletId = paymentData.walletId as string;
    const currency = paymentData.currency as string;

    if (!walletId || !currency) {
      return {
        status: 'error',
        data: paymentData,
        error: 'Missing walletId or currency for refund',
      };
    }

    try {
      const amount = Money.fromMinor(BigInt(refundAmountMinor), currency);
      const tx = await this.walletService.adminCreditWallet({
        walletId,
        amount,
        reason: `Refund for order ${paymentData.orderId || 'unknown'}: ${reason}`,
        adminId: 'system_refund',
        idempotencyKey,
      });

      return {
        status: 'captured',
        data: {
          ...paymentData,
          refundTransactionId: tx.id,
          refundAmount: amount.amount.toString(),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'error',
        data: paymentData,
        error: message,
      };
    }
  }
}
