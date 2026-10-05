import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  GatewayError,
  GatewayNotFoundError,
  GatewayDisabledError,
  UnsupportedCapabilityError,
  PaymentError,
  InvalidPaymentStateError,
  TransactionError,
  ConfigurationError,
} from '../src/core/errors/index.js';

describe('Error Architecture', () => {
  it('should formulate error response in toJSON()', () => {
    const err = new ValidationError('Invalid input field', { field: 'amount' });
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.toJSON()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input field',
        statusCode: 400,
        details: { field: 'amount' },
      },
    });
  });

  it('should correctly capture cause if provided', () => {
    const inner = new Error('Socket timeout');
    const gatewayErr = new GatewayError('Gateway failure', 'mellat', 'TIMEOUT', undefined, inner);

    expect(gatewayErr.cause).toBe(inner);
    expect(gatewayErr.providerErrorCode).toBe('TIMEOUT');
  });

  it('should instantiate all standard error types with correct status codes', () => {
    expect(new GatewayNotFoundError('g1').statusCode).toBe(404);
    expect(new GatewayDisabledError('g1').statusCode).toBe(422);
    expect(new UnsupportedCapabilityError('g1', 'REFUND').statusCode).toBe(422);
    expect(new PaymentError('Failed').statusCode).toBe(400);
    expect(new InvalidPaymentStateError('CREATED', 'SUCCESS').statusCode).toBe(400);
    expect(new TransactionError('Failed tx').statusCode).toBe(400);
    expect(new ConfigurationError('Bad config').statusCode).toBe(500);
  });
});
