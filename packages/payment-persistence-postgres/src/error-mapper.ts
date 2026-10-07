import {
  PersistenceError,
  PersistenceConflictError,
  PersistenceUnavailableError,
} from '@amirhossein-moloki/payment-core';

export function mapPgError(error: unknown, contextMessage?: string): Error {
  if (error instanceof PersistenceError) {
    return error;
  }

  const err = error as { code?: string; message?: string; detail?: string };
  const message = contextMessage
    ? `${contextMessage}: ${err.message || String(error)}`
    : err.message || String(error);

  // PG error code 23505 = unique_violation
  if (err.code === '23505') {
    return new PersistenceConflictError(message, { pgCode: err.code, detail: err.detail }, error);
  }

  // PG error codes starting with 08 (connection exceptions) or ECONNREFUSED
  if (err.code?.startsWith('08') || err.code === 'ECONNREFUSED' || err.code === '57P01') {
    return new PersistenceUnavailableError(message, { pgCode: err.code }, error);
  }

  return new PersistenceError(message, 500, { pgCode: err.code, detail: err.detail }, error);
}
