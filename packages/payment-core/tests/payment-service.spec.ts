import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentService } from '../src/core/services/payment.service.js';
import { GatewayRegistry } from '../src/core/registry/gateway.registry.js';
import { MockGateway } from './mocks/mock-gateway.js';
import { Payment } from '../src/core/domain/payment/payment.entity.js';
import { PaymentStatus } from '../src/core/domain/payment/payment-status.enum.js';
import {
  TransactionType,
  TransactionStatus,
} from '../src/core/domain/transaction/transaction.entity.js';

describe('PaymentService', () => {
  let registry: GatewayRegistry;
  let mockGateway: MockGateway;
  let service: PaymentService;

  beforeEach(() => {
    registry = new GatewayRegistry();
    mockGateway = new MockGateway({ id: 'mock' });
    registry.register(mockGateway);
    service = new PaymentService(registry);
  });

  it('should successfully create a payment', async () => {
    const payment = new Payment({ amount: 1000, currency: 'USD', gateway: 'mock' });
    const result = await service.createPayment(payment);

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.PENDING);
    expect(result.transaction.type).toBe(TransactionType.PAYMENT);
    expect(result.transaction.status).toBe(TransactionStatus.SUCCESS);
  });

  it('should successfully verify a payment', async () => {
    const payment = new Payment({
      amount: 1000,
      currency: 'USD',
      gateway: 'mock',
      status: PaymentStatus.CALLBACK_RECEIVED,
    });
    const result = await service.verifyPayment(payment, { gatewayTransactionId: 'tx_123' });

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
    expect(result.transaction.type).toBe(TransactionType.VERIFY);
  });

  it('should handle inquiry payment', async () => {
    const payment = new Payment({
      amount: 1000,
      currency: 'USD',
      gateway: 'mock',
      status: PaymentStatus.PENDING,
    });
    const result = await service.inquiryPayment(payment);

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
  });

  it('should handle refund payment', async () => {
    const payment = new Payment({
      amount: 1000,
      currency: 'USD',
      gateway: 'mock',
      status: PaymentStatus.SUCCESS,
    });
    const result = await service.refundPayment(payment, { reason: 'Customer requested' });

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.REFUNDED);
  });

  it('should handle reverse payment', async () => {
    const payment = new Payment({
      amount: 1000,
      currency: 'USD',
      gateway: 'mock',
      status: PaymentStatus.SUCCESS,
    });
    const result = await service.reversePayment(payment, { reason: 'System error' });

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.REVERSED);
  });

  it('should handle authorize and capture flow', async () => {
    const payment = new Payment({ amount: 1000, currency: 'USD', gateway: 'mock' });
    const authResult = await service.authorizePayment(payment);

    expect(authResult.response.success).toBe(true);
    expect(authResult.payment.status).toBe(PaymentStatus.AUTHORIZED);
    expect(authResult.transaction.type).toBe(TransactionType.AUTHORIZATION);

    const capResult = await service.capturePayment(payment);
    expect(capResult.response.success).toBe(true);
    expect(capResult.payment.status).toBe(PaymentStatus.SUCCESS);
    expect(capResult.transaction.type).toBe(TransactionType.CAPTURE);
  });

  it('should handle cancel payment', async () => {
    const payment = new Payment({
      amount: 1000,
      currency: 'USD',
      gateway: 'mock',
      status: PaymentStatus.AUTHORIZED,
    });
    const result = await service.cancelPayment(payment, { reason: 'Order cancelled' });

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.CANCELLED);
    expect(result.transaction.type).toBe(TransactionType.CANCEL);
  });

  it('should handle partial refund', async () => {
    const payment = new Payment({
      amount: 1000,
      currency: 'USD',
      gateway: 'mock',
      status: PaymentStatus.SUCCESS,
    });
    const result = await service.refundPayment(payment, { amount: 400, reason: 'Partial refund' });

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
  });

  it('should parse callback and webhook', async () => {
    const cbResult = await service.parseCallback('mock', {
      query: { Authority: 'auth_123', paymentId: 'pay_123' },
      body: {},
      headers: {},
    });
    expect(cbResult.isSuccess).toBe(true);
    expect(cbResult.gatewayTransactionId).toBe('auth_123');

    const whResult = await service.parseWebhook('mock', {
      query: {},
      body: { event: 'payment.succeeded', payment_id: 'pay_123' },
      headers: {},
    });
    expect(whResult.eventType).toBe('payment.succeeded');
    expect(whResult.paymentId).toBe('pay_123');
  });
});
