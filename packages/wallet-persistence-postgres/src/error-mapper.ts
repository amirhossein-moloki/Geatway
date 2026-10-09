import {
  PersistenceConflictError,
  PersistenceError,
  PersistenceUnavailableError,
} from '@amirhossein-moloki/payment-core';
import { WalletError } from '@amirhossein-moloki/wallet-core';

export function mapWalletPgError(error: unknown, contextMessage?: string): Error {
  if (error instanceof WalletError || error instanceof PersistenceError) {
    return error;
  }

  const err = error as { code?: string; message?: string; detail?: string };
  const baseMessage = err.message || String(error);
  const message = contextMessage ? `${contextMessage}: ${baseMessage}` : baseMessage;

  // PG error code 23505 = unique_violation
  if (err.code === '23505') {
    return new PersistenceConflictError(message, { pgCode: err.code, detail: err.detail }, error);
  }

  // PG error codes starting with 08 (connection exceptions), ECONNREFUSED, or administrator shutdown 57P01
  if (err.code?.startsWith('08') || err.code === 'ECONNREFUSED' || err.code === '57P01') {
    return new PersistenceUnavailableError(message, { pgCode: err.code }, error);
  }

  // Deadlock detected (40P01) or serialization failure (40001)
  if (err.code === '40P01' || err.code === '40001') {
    return new PersistenceConflictError(
      `Concurrency conflict (${err.code}): ${message}`,
      { pgCode: err.code, detail: err.detail },
      error,
    );
  }

  return new PersistenceError(message, 500, { pgCode: err.code, detail: err.detail }, error);
}
