import { describe, expect, it } from 'vitest';
import {
  InvalidSmsStateError,
  SmsConfigurationError,
  SmsProviderDisabledError,
  SmsProviderError,
  SmsProviderNotFoundError,
  SmsValidationError,
  UnsupportedSmsCapabilityError,
} from '../src/core/errors/index.js';

describe('SMS Error Hierarchy', () => {
  it('should construct SmsValidationError with statusCode 400', () => {
    const err = new SmsValidationError('Invalid parameter', { field: 'mobile' });
    expect(err.code).toBe('SMS_VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: 'mobile' });

    const json = err.toJSON();
    expect(json).toEqual({
      error: {
        code: 'SMS_VALIDATION_ERROR',
        message: 'Invalid parameter',
        statusCode: 400,
        details: { field: 'mobile' },
      },
    });
  });

  it('should construct SmsProviderError with providerId and providerErrorCode', () => {
    const err = new SmsProviderError('Gateway timeout', 'sms-ir', 504);
    expect(err.code).toBe('SMS_PROVIDER_ERROR');
    expect(err.statusCode).toBe(502);
    expect(err.providerId).toBe('sms-ir');
    expect(err.providerErrorCode).toBe(504);
  });

  it('should construct SmsProviderNotFoundError with 404', () => {
    const err = new SmsProviderNotFoundError('unknown-provider');
    expect(err.code).toBe('SMS_PROVIDER_NOT_FOUND_ERROR');
    expect(err.statusCode).toBe(404);
  });

  it('should construct SmsProviderDisabledError with 422', () => {
    const err = new SmsProviderDisabledError('disabled-provider');
    expect(err.code).toBe('SMS_PROVIDER_DISABLED_ERROR');
    expect(err.statusCode).toBe(422);
  });

  it('should construct UnsupportedSmsCapabilityError with 422', () => {
    const err = new UnsupportedSmsCapabilityError('sms-ir', 'WEBHOOK');
    expect(err.code).toBe('UNSUPPORTED_SMS_CAPABILITY_ERROR');
    expect(err.statusCode).toBe(422);
    expect(err.details?.capability).toBe('WEBHOOK');
  });

  it('should construct SmsConfigurationError with 500', () => {
    const err = new SmsConfigurationError('Missing API key');
    expect(err.code).toBe('SMS_CONFIGURATION_ERROR');
    expect(err.statusCode).toBe(500);
  });

  it('should construct InvalidSmsStateError with 400', () => {
    const err = new InvalidSmsStateError('PENDING', 'DELIVERED');
    expect(err.code).toBe('INVALID_SMS_STATE_ERROR');
    expect(err.statusCode).toBe(400);
  });
});
