import { describe, it, expect } from 'vitest';
import {
  Payment,
  PaymentStatus,
  PaymentStateMachine,
  ValidationError,
  InvalidStateTransitionError,
} from '../src/index.js';

describe('Payment Entity & State Machine', () => {
  it('should successfully create a valid payment', () => {
    const payment = new Payment({
      projectId: 'proj_123',
      amount: 10000,
      currency: 'IRR',
      gateway: 'mock_gateway',
      description: 'Test payment',
    });

    expect(payment.id).toBeDefined();
    expect(payment.id.startsWith('pay_')).toBe(true);
    expect(payment.projectId).toBe('proj_123');
    expect(payment.amount).toBe(10000);
    expect(payment.currency).toBe('IRR');
    expect(payment.gateway).toBe('mock_gateway');
    expect(payment.status).toBe(PaymentStatus.CREATED);
    expect(payment.createdAt).toBeInstanceOf(Date);
    expect(payment.updatedAt).toBeInstanceOf(Date);
  });

  it('should throw ValidationError if required fields are missing or invalid', () => {
    expect(
      () =>
        new Payment({
          projectId: '',
          amount: 1000,
          currency: 'IRR',
          gateway: 'mock_gateway',
        }),
    ).toThrow(ValidationError);

    expect(
      () =>
        new Payment({
          projectId: 'proj_123',
          amount: 0,
          currency: 'IRR',
          gateway: 'mock_gateway',
        }),
    ).toThrow(ValidationError);

    expect(
      () =>
        new Payment({
          projectId: 'proj_123',
          amount: 1000,
          currency: '',
          gateway: 'mock_gateway',
        }),
    ).toThrow(ValidationError);

    expect(
      () =>
        new Payment({
          projectId: 'proj_123',
          amount: 1000,
          currency: 'IRR',
          gateway: '',
        }),
    ).toThrow(ValidationError);
  });

  it('should allow valid status transitions', () => {
    const payment = new Payment({
      projectId: 'proj_123',
      amount: 5000,
      currency: 'USD',
      gateway: 'mock_gateway',
    });

    expect(payment.status).toBe(PaymentStatus.CREATED);

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

  it('should disallow invalid status transitions', () => {
    const payment = new Payment({
      projectId: 'proj_123',
      amount: 5000,
      currency: 'USD',
      gateway: 'mock_gateway',
    });

    expect(() => payment.transitionTo(PaymentStatus.SUCCESS)).toThrow(InvalidStateTransitionError);
  });

  it('should correctly evaluate PaymentStateMachine transitions', () => {
    expect(PaymentStateMachine.canTransition(PaymentStatus.CREATED, PaymentStatus.PENDING)).toBe(
      true,
    );
    expect(PaymentStateMachine.canTransition(PaymentStatus.SUCCESS, PaymentStatus.CREATED)).toBe(
      false,
    );
    expect(PaymentStateMachine.canTransition(PaymentStatus.FAILED, PaymentStatus.SUCCESS)).toBe(
      false,
    );
  });
});
