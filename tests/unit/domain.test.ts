import { describe, it, expect } from 'vitest';
import {
  PaymentStatus,
  PaymentStatusMachine,
  Payment,
  Transaction,
  TransactionType,
  Gateway,
  GatewayCapability,
} from '../../src';

describe('PaymentStatusMachine', () => {
  it('allows valid state transitions', () => {
    expect(PaymentStatusMachine.canTransition(PaymentStatus.CREATED, PaymentStatus.PENDING)).toBe(
      true,
    );
    expect(PaymentStatusMachine.canTransition(PaymentStatus.PENDING, PaymentStatus.SUCCESS)).toBe(
      true,
    );
    expect(PaymentStatusMachine.canTransition(PaymentStatus.SUCCESS, PaymentStatus.REFUNDED)).toBe(
      true,
    );
    expect(PaymentStatusMachine.canTransition(PaymentStatus.SUCCESS, PaymentStatus.REVERSED)).toBe(
      true,
    );
  });

  it('rejects invalid state transitions', () => {
    expect(PaymentStatusMachine.canTransition(PaymentStatus.SUCCESS, PaymentStatus.CREATED)).toBe(
      false,
    );
    expect(PaymentStatusMachine.canTransition(PaymentStatus.FAILED, PaymentStatus.SUCCESS)).toBe(
      false,
    );
    expect(PaymentStatusMachine.canTransition(PaymentStatus.CANCELLED, PaymentStatus.PENDING)).toBe(
      false,
    );
    expect(PaymentStatusMachine.canTransition(PaymentStatus.REFUNDED, PaymentStatus.SUCCESS)).toBe(
      false,
    );
  });

  it('correctly identifies terminal statuses', () => {
    expect(PaymentStatusMachine.isTerminal(PaymentStatus.SUCCESS)).toBe(false);
    expect(PaymentStatusMachine.isTerminal(PaymentStatus.FAILED)).toBe(true);
    expect(PaymentStatusMachine.isTerminal(PaymentStatus.CANCELLED)).toBe(true);
    expect(PaymentStatusMachine.isTerminal(PaymentStatus.REFUNDED)).toBe(true);
    expect(PaymentStatusMachine.isTerminal(PaymentStatus.REVERSED)).toBe(true);
  });
});

describe('Payment Domain Entity', () => {
  it('creates immutable Payment entity', () => {
    const now = new Date();
    const payment = new Payment({
      id: 'pay_123',
      projectId: 'proj_456',
      amount: 1000,
      currency: 'IRR',
      callbackUrl: 'https://app.com/callback',
      gateway: 'zarinpal',
      status: PaymentStatus.CREATED,
      metadata: { orderId: 'ord_789' },
      createdAt: now,
      updatedAt: now,
    });

    expect(payment.id).toBe('pay_123');
    expect(payment.status).toBe(PaymentStatus.CREATED);
    expect(payment.metadata.orderId).toBe('ord_789');

    const updated = payment.withStatus(PaymentStatus.PENDING);
    expect(updated.status).toBe(PaymentStatus.PENDING);
    expect(payment.status).toBe(PaymentStatus.CREATED); // Immutability test
  });
});

describe('Transaction Domain Entity', () => {
  it('creates immutable Transaction entity', () => {
    const now = new Date();
    const tx = new Transaction({
      id: 'tx_123',
      paymentId: 'pay_123',
      gateway: 'zarinpal',
      type: TransactionType.PAYMENT,
      status: PaymentStatus.SUCCESS,
      amount: 1000,
      gatewayTransactionId: 'gtx_999',
      createdAt: now,
      updatedAt: now,
    });

    expect(tx.id).toBe('tx_123');
    expect(tx.type).toBe(TransactionType.PAYMENT);
    expect(tx.gatewayTransactionId).toBe('gtx_999');
  });
});

describe('Gateway Domain Entity', () => {
  it('checks capabilities correctly', () => {
    const gateway = new Gateway({
      id: 'gw_1',
      name: 'gw_1',
      displayName: 'Gateway 1',
      enabled: true,
      capabilities: new Set([GatewayCapability.CREATE_PAYMENT, GatewayCapability.VERIFY]),
    });

    expect(gateway.supportsCapability(GatewayCapability.CREATE_PAYMENT)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.REFUND)).toBe(false);
  });
});
