import { describe, it, expect, beforeEach } from 'vitest';
import {
  Payment,
  PaymentStatus,
  ConcurrencyError,
  IdempotencyRecord,
  IdempotencyStatus,
} from '@company/payment-core';
import { PostgresPaymentRepository } from '../src/repositories/postgres-payment-repository.js';
import { PostgresIdempotencyRepository } from '../src/repositories/postgres-idempotency-repository.js';
import { createTestDatabase } from './test-utils.js';
import { PgExecutor } from '../src/migrator.js';

describe('Concurrency & Safety Protections', () => {
  let db: PgExecutor;
  let paymentRepo: PostgresPaymentRepository;
  let idempotencyRepo: PostgresIdempotencyRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    paymentRepo = new PostgresPaymentRepository(db);
    idempotencyRepo = new PostgresIdempotencyRepository(db);
  });

  it('should protect against concurrent payment updates using optimistic locking version check', async () => {
    const payment = new Payment({
      amount: 5000,
      currency: 'IRR',
      gateway: 'zibal',
      status: PaymentStatus.CREATED,
    });
    await paymentRepo.create(payment);

    // Prepare two payment instances derived from the same initial stored state (version 1)
    const paymentCopyA = new Payment({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      gateway: payment.gateway,
      status: PaymentStatus.CREATED,
      version: 1,
    });
    paymentCopyA.transitionTo(PaymentStatus.PENDING);

    const paymentCopyB = new Payment({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      gateway: payment.gateway,
      status: PaymentStatus.CREATED,
      version: 1,
    });
    paymentCopyB.transitionTo(PaymentStatus.FAILED);

    // Execute concurrent updates starting from version 1
    const results = await Promise.allSettled([
      paymentRepo.update(paymentCopyA, 1),
      paymentRepo.update(paymentCopyB, 1),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(ConcurrencyError);
    }

    // Verify stored payment version is now 2
    const finalPayment = await paymentRepo.findById(payment.id);
    expect(finalPayment?.version).toBe(2);
  });

  it('should handle concurrent duplicate idempotency requests atomically without corrupting state', async () => {
    const recordA = new IdempotencyRecord({
      scope: 'checkout',
      key: 'key_concurrent_123',
      requestHash: 'hash_fixed',
      status: IdempotencyStatus.PENDING,
    });

    const recordB = new IdempotencyRecord({
      scope: 'checkout',
      key: 'key_concurrent_123',
      requestHash: 'hash_fixed',
      status: IdempotencyStatus.PENDING,
    });

    const results = await Promise.all([
      idempotencyRepo.save(recordA),
      idempotencyRepo.save(recordB),
    ]);

    expect(results[0].key).toBe('key_concurrent_123');
    expect(results[1].key).toBe('key_concurrent_123');

    const stored = await idempotencyRepo.findByScopeAndKey('checkout', 'key_concurrent_123');
    expect(stored).not.toBeNull();
  });
});
