import { PaymentPlatformError } from '@amirhossein-moloki/payment-core';

export class WalletError extends PaymentPlatformError {
  public override readonly code: string = 'WALLET_ERROR';

  constructor(
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, statusCode, details, cause);
  }
}

export class CurrencyMismatchError extends WalletError {
  public override readonly code: string = 'CURRENCY_MISMATCH_ERROR';

  constructor(
    expectedCurrency: string,
    actualCurrency: string,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(
      message ?? `Currency mismatch: expected '${expectedCurrency}', got '${actualCurrency}'`,
      400,
      { ...details, expectedCurrency, actualCurrency },
    );
  }
}

export class UnbalancedTransactionError extends WalletError {
  public override readonly code: string = 'UNBALANCED_TRANSACTION_ERROR';

  constructor(
    totalDebits: string,
    totalCredits: string,
    currency: string,
    details?: Record<string, unknown>,
  ) {
    super(
      `Transaction is unbalanced for currency '${currency}': debits (${totalDebits}) != credits (${totalCredits})`,
      400,
      { ...details, totalDebits, totalCredits, currency },
    );
  }
}

export class InvalidAmountError extends WalletError {
  public override readonly code: string = 'INVALID_AMOUNT_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, details);
  }
}

export class InvalidWalletStateError extends WalletError {
  public override readonly code: string = 'INVALID_WALLET_STATE_ERROR';

  constructor(
    currentStatus: string,
    targetStatus?: string,
    details?: Record<string, unknown>,
  ) {
    const msg = targetStatus
      ? `Invalid wallet status transition from '${currentStatus}' to '${targetStatus}'`
      : `Operation not allowed on wallet with status '${currentStatus}'`;
    super(msg, 400, { ...details, currentStatus, targetStatus });
  }
}

export class WalletFrozenError extends WalletError {
  public override readonly code: string = 'WALLET_FROZEN_ERROR';

  constructor(walletId: string, details?: Record<string, unknown>) {
    super(`Wallet '${walletId}' is frozen`, 422, { ...details, walletId });
  }
}

export class WalletClosedError extends WalletError {
  public override readonly code: string = 'WALLET_CLOSED_ERROR';

  constructor(walletId: string, details?: Record<string, unknown>) {
    super(`Wallet '${walletId}' is closed`, 422, { ...details, walletId });
  }
}

export class InvalidLedgerEntryError extends WalletError {
  public override readonly code: string = 'INVALID_LEDGER_ENTRY_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, details);
  }
}

export class EmptyTransactionError extends WalletError {
  public override readonly code: string = 'EMPTY_TRANSACTION_ERROR';

  constructor(message = 'A ledger transaction must contain at least two entries', details?: Record<string, unknown>) {
    super(message, 400, details);
  }
}

export class ImmutableTransactionError extends WalletError {
  public override readonly code: string = 'IMMUTABLE_TRANSACTION_ERROR';

  constructor(
    transactionId: string,
    message = `Posted transaction '${transactionId}' cannot be modified or re-posted`,
    details?: Record<string, unknown>,
  ) {
    super(message, 400, { ...details, transactionId });
  }
}
