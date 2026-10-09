import { describe, expect, it } from 'vitest';
import { PaymentPlatformError } from '@amirhossein-moloki/payment-core';
import {
  CurrencyMismatchError,
  UnbalancedTransactionError,
  WalletError,
  WalletFrozenError,
} from '../src/index.js';

describe('Wallet Core Domain Errors', () => {
  it('should inherit from PaymentPlatformError and produce standard JSON format', () => {
    const err = new WalletFrozenError('w-99');

    expect(err).toBeInstanceOf(PaymentPlatformError);
    expect(err).toBeInstanceOf(WalletError);
    expect(err.code).toBe('WALLET_FROZEN_ERROR');
    expect(err.statusCode).toBe(422);

    const json = err.toJSON();
    expect(json).toEqual({
      error: {
        code: 'WALLET_FROZEN_ERROR',
        message: "Wallet 'w-99' is frozen",
        statusCode: 422,
        details: { walletId: 'w-99' },
      },
    });
  });

  it('should contain currency mismatch details', () => {
    const err = new CurrencyMismatchError('USD', 'EUR');
    expect(err.code).toBe('CURRENCY_MISMATCH_ERROR');
    expect(err.details).toEqual({ expectedCurrency: 'USD', actualCurrency: 'EUR' });
  });

  it('should contain unbalanced transaction details', () => {
    const err = new UnbalancedTransactionError('100', '90', 'USD');
    expect(err.code).toBe('UNBALANCED_TRANSACTION_ERROR');
    expect(err.details).toEqual({ totalDebits: '100', totalCredits: '90', currency: 'USD' });
  });
});
