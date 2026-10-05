import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  GatewayError,
  GatewayNotFoundError,
  GatewayDisabledError,
  UnsupportedCapabilityError,
  PaymentError,
  InvalidStateTransitionError,
  TransactionError,
  ConfigurationError,
} from '../src/index.js';

describe('Error Hierarchy & Formatting', () => {
  it('should instantiate ValidationError with correct code and status', () => {
    const err = new ValidationError('Invalid input', { field: 'amount' });
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: 'amount' });
  });

  it('should instantiate GatewayError with provider details', () => {
    const err = new GatewayError('Provider timed out', 'zarinpal', -11);
    expect(err.code).toBe('GATEWAY_ERROR');
    expect(err.statusCode).toBe(502);
    expect(err.gatewayId).toBe('zarinpal');
    expect(err.providerErrorCode).toBe(-11);
  });

  it('should instantiate GatewayNotFoundError with 404 status', () => {
    const err = new GatewayNotFoundError('unknown_gw');
    expect(err.code).toBe('GATEWAY_NOT_FOUND_ERROR');
    expect(err.statusCode).toBe(404);
  });

  it('should instantiate GatewayDisabledError with 422 status', () => {
    const err = new GatewayDisabledError('disabled_gw');
    expect(err.code).toBe('GATEWAY_DISABLED_ERROR');
    expect(err.statusCode).toBe(422);
  });

  it('should instantiate UnsupportedCapabilityError with 422 status', () => {
    const err = new UnsupportedCapabilityError('gw1', 'RECURRING');
    expect(err.code).toBe('UNSUPPORTED_CAPABILITY_ERROR');
    expect(err.statusCode).toBe(422);
  });

  it('should instantiate PaymentError, TransactionError, and ConfigurationError correctly', () => {
    const payErr = new PaymentError('Generic payment error');
    expect(payErr.code).toBe('PAYMENT_ERROR');
    expect(payErr.statusCode).toBe(400);

    const txErr = new TransactionError('Transaction failed');
    expect(txErr.code).toBe('TRANSACTION_ERROR');
    expect(txErr.statusCode).toBe(400);

    const cfgErr = new ConfigurationError('Invalid configuration');
    expect(cfgErr.code).toBe('CONFIGURATION_ERROR');
    expect(cfgErr.statusCode).toBe(500);
  });

  it('should format to JSON standard error representation', () => {
    const err = new InvalidStateTransitionError('CREATED', 'SUCCESS');
    const json = err.toJSON();

    expect(json).toEqual({
      error: {
        code: 'INVALID_STATE_TRANSITION_ERROR',
        message: "Invalid payment status transition from 'CREATED' to 'SUCCESS'",
        statusCode: 400,
        details: { currentStatus: 'CREATED', targetStatus: 'SUCCESS' },
      },
    });
  });
});
