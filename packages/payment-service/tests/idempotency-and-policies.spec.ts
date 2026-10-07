import { describe, it, expect, beforeEach } from 'vitest';
import { PersistenceConflictError, GatewayError } from '@amirhossein-moloki/payment-core';
import { createTestPaymentService, TestEnvironment } from '../src/testing/index.js';
import { RetryPolicy } from '../src/policies/retry-policy.js';
import { TimeoutPolicy, OperationTimeoutError } from '../src/policies/timeout-policy.js';
import { sanitizeContext } from '../src/observability/logger.js';

describe('Idempotency & Policies Unit Tests', () => {
  let env: TestEnvironment;

  beforeEach(() => {
    env = createTestPaymentService();
  });

  describe('Idempotency Key Protection', () => {
    it('should return cached result when identical request is made with same idempotency key', async () => {
      const input = {
        gateway: 'test-gateway',
        amount: 50000,
        currency: 'IRR',
        idempotencyKey: 'key_123',
      };

      const res1 = await env.service.createPayment(input);
      const callsBefore = env.gateway.callCount['createPayment'] || 0;

      const res2 = await env.service.createPayment(input);

      expect(res2.payment.id).toBe(res1.payment.id);
      expect(res2.transaction.id).toBe(res1.transaction.id);
      expect(env.gateway.callCount['createPayment']).toBe(callsBefore);
    });

    it('should throw PersistenceConflictError if same idempotency key is used with different payload', async () => {
      await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 50000,
        currency: 'IRR',
        idempotencyKey: 'key_conflict_1',
      });

      await expect(
        env.service.createPayment({
          gateway: 'test-gateway',
          amount: 99999,
          currency: 'IRR',
          idempotencyKey: 'key_conflict_1',
        }),
      ).rejects.toThrow(PersistenceConflictError);
    });

    it('should isolate idempotency keys across different operation scopes', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 10000,
        currency: 'IRR',
        idempotencyKey: 'shared_key',
      });

      await env.service.verifyPayment({
        paymentId: created.payment.id,
      });

      const refundResult = await env.service.refundPayment({
        paymentId: created.payment.id,
        amount: 10000,
        idempotencyKey: 'shared_key',
      });

      expect(refundResult.amountRefunded).toBe(10000);
    });
  });

  describe('RetryPolicy', () => {
    it('should retry transient errors up to maxAttempts', async () => {
      const retryPolicy = new RetryPolicy({ maxAttempts: 3, initialDelayMs: 1, jitter: false });

      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new GatewayError('Transient network failure', 'test', 503);
        }
        return 'success';
      };

      const result = await retryPolicy.execute(fn);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should not retry non-retryable validation or conflict errors', async () => {
      const retryPolicy = new RetryPolicy({ maxAttempts: 3, initialDelayMs: 1 });

      let attempts = 0;
      const fn = async () => {
        attempts++;
        throw new PersistenceConflictError('Conflict!');
      };

      await expect(retryPolicy.execute(fn)).rejects.toThrow(PersistenceConflictError);
      expect(attempts).toBe(1);
    });
  });

  describe('TimeoutPolicy', () => {
    it('should throw OperationTimeoutError when operation exceeds timeout', async () => {
      const slowFn = new Promise((resolve) => setTimeout(resolve, 500));

      await expect(TimeoutPolicy.withTimeout(slowFn, 50, 'SlowGatewayCall')).rejects.toThrow(
        OperationTimeoutError,
      );
    });

    it('should resolve normally if operation finishes before timeout', async () => {
      const fastFn = Promise.resolve('fast_result');

      const res = await TimeoutPolicy.withTimeout(fastFn, 1000, 'FastCall');
      expect(res).toBe('fast_result');
    });
  });

  describe('Observability Context Sanitization', () => {
    it('should redact sensitive credentials, card numbers, and tokens from logger context', () => {
      const sensitiveInput = {
        paymentId: 'pay_123',
        cardNumber: '6037991122334455',
        cvv: '123',
        password: 'super_secret_password',
        merchantId: 'm_001',
        token: 'bearer_token_xyz',
        nested: {
          apiKey: 'key_12345',
          safeField: 'visible_data',
        },
      };

      const sanitized = sanitizeContext(sensitiveInput);

      expect(sanitized?.['paymentId']).toBe('pay_123');
      expect(sanitized?.['cardNumber']).toBe('[REDACTED]');
      expect(sanitized?.['cvv']).toBe('[REDACTED]');
      expect(sanitized?.['password']).toBe('[REDACTED]');
      expect(sanitized?.['token']).toBe('[REDACTED]');
      expect((sanitized?.['nested'] as Record<string, unknown>)['apiKey']).toBe('[REDACTED]');
      expect((sanitized?.['nested'] as Record<string, unknown>)['safeField']).toBe('visible_data');
    });
  });
});
