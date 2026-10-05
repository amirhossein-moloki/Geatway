import { describe, it, expect } from 'vitest';
import { Payment } from '../src/core/domain/payment/payment.entity.js';
import { PaymentStatus } from '../src/core/domain/payment/payment-status.enum.js';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../src/core/domain/transaction/transaction.entity.js';
import { ValidationError, InvalidPaymentStateError } from '../src/core/errors/index.js';

describe('Payment Domain', () => {
  it('should create a valid payment entity', () => {
    const payment = new Payment({
      amount: 1000,
      currency: 'IRR',
      description: 'Test payment',
      gateway: 'mock',
    });

    expect(payment.id).toBeDefined();
    expect(payment.amount).toBe(1000);
    expect(payment.currency).toBe('IRR');
    expect(payment.status).toBe(PaymentStatus.CREATED);
  });

  it('should throw validation error on invalid amount or currency', () => {
    expect(() => new Payment({ amount: -50, currency: 'IRR' })).toThrow(ValidationError);
    expect(() => new Payment({ amount: 100, currency: '' })).toThrow(ValidationError);
  });

  it('should transition status according to state machine', () => {
    const payment = new Payment({ amount: 1000, currency: 'USD', gateway: 'mock' });
    payment.transitionTo(PaymentStatus.PENDING);
    expect(payment.status).toBe(PaymentStatus.PENDING);

    payment.transitionTo(PaymentStatus.REDIRECTED);
    expect(payment.status).toBe(PaymentStatus.REDIRECTED);

    payment.transitionTo(PaymentStatus.CALLBACK_RECEIVED);
    expect(payment.status).toBe(PaymentStatus.CALLBACK_RECEIVED);

    payment.transitionTo(PaymentStatus.SUCCESS);
    expect(payment.status).toBe(PaymentStatus.SUCCESS);

    payment.transitionTo(PaymentStatus.REFUNDED);
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
  });

  it('should throw InvalidPaymentStateError on unlawful transition', () => {
    const payment = new Payment({ amount: 1000, currency: 'USD', gateway: 'mock' });
    expect(() => payment.transitionTo(PaymentStatus.SUCCESS)).toThrow(InvalidPaymentStateError);
  });

  it('should create a valid transaction entity', () => {
    const tx = new Transaction({
      paymentId: 'pay_123',
      gateway: 'mock',
      type: TransactionType.PAYMENT,
      status: TransactionStatus.SUCCESS,
      amount: 1000,
    });

    expect(tx.id).toBeDefined();
    expect(tx.type).toBe(TransactionType.PAYMENT);
    expect(tx.status).toBe(TransactionStatus.SUCCESS);
  });
});
