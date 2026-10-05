import { describe, it, expect, beforeEach } from 'vitest';
import {
  GatewayRegistry,
  PaymentService,
  MockGateway,
  Payment,
  PaymentStatus,
  TransactionType,
  TransactionStatus,
  GatewayError,
} from '../src/index.js';

describe('PaymentService Core Orchestrator & MockGateway Integration', () => {
  let registry: GatewayRegistry;
  let service: PaymentService;
  let mockGateway: MockGateway;

  beforeEach(() => {
    registry = new GatewayRegistry();
    mockGateway = new MockGateway({ id: 'mock_gw' });
    registry.registerGateway(mockGateway);
    service = new PaymentService(registry);
  });

  it('should create payment successfully via MockGateway', async () => {
    const payment = new Payment({
      projectId: 'proj_1',
      amount: 250000,
      currency: 'IRR',
      gateway: 'mock_gw',
    });

    const result = await service.createPayment(payment);

    expect(result.response.success).toBe(true);
    expect(result.response.redirectUrl).toBeDefined();
    expect(result.payment.status).toBe(PaymentStatus.PENDING);
    expect(result.transaction).toBeDefined();
    expect(result.transaction.type).toBe(TransactionType.PAYMENT);
    expect(result.transaction.status).toBe(TransactionStatus.SUCCESS);
  });

  it('should handle payment verification flow', async () => {
    const payment = new Payment({
      projectId: 'proj_1',
      amount: 250000,
      currency: 'IRR',
      gateway: 'mock_gw',
      status: PaymentStatus.PENDING,
    });

    const result = await service.verifyPayment(payment, {
      gatewayTransactionId: 'mock_tx_123',
    });

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
    expect(result.transaction.type).toBe(TransactionType.VERIFY);
    expect(result.transaction.status).toBe(TransactionStatus.SUCCESS);
  });

  it('should handle payment inquiry flow', async () => {
    const payment = new Payment({
      projectId: 'proj_1',
      amount: 100000,
      currency: 'IRR',
      gateway: 'mock_gw',
      status: PaymentStatus.PENDING,
    });

    const result = await service.inquiryPayment(payment);

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
    expect(result.transaction.type).toBe(TransactionType.INQUIRY);
  });

  it('should handle refund flow', async () => {
    const payment = new Payment({
      projectId: 'proj_1',
      amount: 100000,
      currency: 'IRR',
      gateway: 'mock_gw',
      status: PaymentStatus.SUCCESS,
    });

    const result = await service.refundPayment(payment, { reason: 'Customer requested' });

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(result.transaction.type).toBe(TransactionType.REFUND);
  });

  it('should handle reverse flow', async () => {
    const payment = new Payment({
      projectId: 'proj_1',
      amount: 100000,
      currency: 'IRR',
      gateway: 'mock_gw',
      status: PaymentStatus.SUCCESS,
    });

    const result = await service.reversePayment(payment, { reason: 'System error' });

    expect(result.response.success).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.REVERSED);
    expect(result.transaction.type).toBe(TransactionType.REVERSE);
  });

  it('should handle failure scenario from MockGateway', async () => {
    const failingGateway = new MockGateway({ id: 'failing_gw', shouldFailVerify: true });
    registry.registerGateway(failingGateway);

    const payment = new Payment({
      projectId: 'proj_1',
      amount: 50000,
      currency: 'USD',
      gateway: 'failing_gw',
      status: PaymentStatus.PENDING,
    });

    const result = await service.verifyPayment(payment, {});

    expect(result.response.success).toBe(false);
    expect(result.payment.status).toBe(PaymentStatus.FAILED);
    expect(result.transaction.status).toBe(TransactionStatus.FAILED);
  });

  it('should throw GatewayError when create payment throws error', async () => {
    const throwingGateway = new MockGateway({ id: 'throwing_gw', shouldFailCreate: true });
    registry.registerGateway(throwingGateway);

    const payment = new Payment({
      projectId: 'proj_1',
      amount: 50000,
      currency: 'USD',
      gateway: 'throwing_gw',
    });

    await expect(service.createPayment(payment)).rejects.toThrow(GatewayError);
  });
});
