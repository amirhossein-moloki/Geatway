import { describe, it, expect, beforeEach } from 'vitest';
import {
  Payment,
  PaymentStatus,
  ConcurrencyError,
  RepositoryNotFoundError,
} from '@amirhossein-moloki/payment-core';
import { PostgresPaymentRepository } from '../src/repositories/postgres-payment-repository.js';
import { PostgresTransactionRepository } from '../src/repositories/postgres-transaction-repository.js';
import { Transaction, TransactionType, TransactionStatus } from '@amirhossein-moloki/payment-core';
import { createTestDatabase } from './test-utils.js';
import { PgExecutor } from '../src/migrator.js';

describe('PostgresPaymentRepository', () => {
  let db: PgExecutor;
  let paymentRepo: PostgresPaymentRepository;
  let txRepo: PostgresTransactionRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    paymentRepo = new PostgresPaymentRepository(db);
    txRepo = new PostgresTransactionRepository(db);
  });

  it('should create and retrieve a payment by ID', async () => {
    const payment = new Payment({
      amount: 10000,
      currency: 'IRR',
      gateway: 'zibal',
      description: 'Test payment',
      idempotencyKey: 'key_123',
    });

    const created = await paymentRepo.create(payment);
    expect(created.id).toBe(payment.id);
    expect(created.amount).toBe(10000);
    expect(created.currency).toBe('IRR');
    expect(created.status).toBe(PaymentStatus.CREATED);
    expect(created.version).toBe(1);

    const found = await paymentRepo.findById(payment.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(payment.id);
    expect(found?.gateway).toBe('zibal');
  });

  it('should return null when finding non-existent payment by ID', async () => {
    const found = await paymentRepo.findById('pay_non_existent');
    expect(found).toBeNull();
  });

  it('should find a payment by external ID / idempotency key or provider transaction reference', async () => {
    const payment = new Payment({
      amount: 5000,
      currency: 'IRR',
      gateway: 'zarinpal',
      idempotencyKey: 'idem_external_key',
    });
    await paymentRepo.create(payment);

    const foundByKey = await paymentRepo.findByExternalId('idem_external_key');
    expect(foundByKey?.id).toBe(payment.id);

    // Also verify finding payment via transaction reference
    const transaction = new Transaction({
      paymentId: payment.id,
      gateway: 'zarinpal',
      type: TransactionType.PAYMENT,
      status: TransactionStatus.SUCCESS,
      amount: 5000,
      reference: 'AUTHORITY_12345',
    });
    await txRepo.create(transaction);

    const foundByRef = await paymentRepo.findByExternalId('AUTHORITY_12345');
    expect(foundByRef?.id).toBe(payment.id);
  });

  it('should update payment status and increment version cleanly', async () => {
    const payment = new Payment({
      amount: 2000,
      currency: 'USD',
      gateway: 'stripe',
    });
    await paymentRepo.create(payment);

    payment.transitionTo(PaymentStatus.PENDING);
    const updated = await paymentRepo.update(payment, 1);

    expect(updated.status).toBe(PaymentStatus.PENDING);
    expect(updated.version).toBe(2);

    const reloaded = await paymentRepo.findById(payment.id);
    expect(reloaded?.version).toBe(2);
    expect(reloaded?.status).toBe(PaymentStatus.PENDING);
  });

  it('should throw ConcurrencyError when updating with wrong expected version', async () => {
    const payment = new Payment({
      amount: 3000,
      currency: 'USD',
      gateway: 'stripe',
    });
    await paymentRepo.create(payment);

    payment.transitionTo(PaymentStatus.PENDING);
    // Supplying mismatched version 99
    await expect(paymentRepo.update(payment, 99)).rejects.toThrow(ConcurrencyError);
  });

  it('should throw RepositoryNotFoundError when updating non-existent payment', async () => {
    const nonExistent = new Payment({
      id: 'pay_does_not_exist',
      amount: 1000,
      currency: 'USD',
    });

    await expect(paymentRepo.update(nonExistent, 1)).rejects.toThrow(RepositoryNotFoundError);
  });

  it('should list payments with filtering and pagination', async () => {
    const p1 = new Payment({
      amount: 1000,
      currency: 'IRR',
      gateway: 'mellat',
      status: PaymentStatus.CREATED,
    });
    const p2 = new Payment({
      amount: 2000,
      currency: 'IRR',
      gateway: 'mellat',
      status: PaymentStatus.SUCCESS,
    });
    const p3 = new Payment({
      amount: 3000,
      currency: 'IRR',
      gateway: 'zibal',
      status: PaymentStatus.SUCCESS,
    });

    await paymentRepo.create(p1);
    await paymentRepo.create(p2);
    await paymentRepo.create(p3);

    const mellatPayments = await paymentRepo.list({ gateway: 'mellat' });
    expect(mellatPayments.length).toBe(2);

    const successPayments = await paymentRepo.list({ status: PaymentStatus.SUCCESS });
    expect(successPayments.length).toBe(2);

    const paginated = await paymentRepo.list({ limit: 2 });
    expect(paginated.length).toBe(2);
  });
});
