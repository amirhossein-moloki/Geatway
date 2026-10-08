import { describe, it, expect, beforeEach } from 'vitest';
import {
  PaymentCoreService,
  GatewayRegistry,
  MockGateway,
  PaymentStatus,
  ValidationError,
  PaymentError,
  ErrorCode,
  GatewayError,
} from '../../src';

describe('PaymentCoreService with MockGateway', () => {
  let registry: GatewayRegistry;
  let service: PaymentCoreService;
  let mockGw: MockGateway;

  beforeEach(() => {
    registry = new GatewayRegistry();
    mockGw = new MockGateway({ id: 'mock-gw', enabled: true });
    registry.registerGateway(mockGw);
    service = new PaymentCoreService(registry);
  });

  it('validates input when creating payment entity', () => {
    expect(() =>
      service.createPaymentEntity({
        id: '',
        projectId: 'p1',
        amount: 100,
        currency: 'USD',
        callbackUrl: 'https://cb.com',
        gateway: 'mock-gw',
      }),
    ).toThrow(ValidationError);

    expect(() =>
      service.createPaymentEntity({
        id: 'pay_1',
        projectId: 'p1',
        amount: -50,
        currency: 'USD',
        callbackUrl: 'https://cb.com',
        gateway: 'mock-gw',
      }),
    ).toThrow(ValidationError);
  });

  it('initiates payment successfully through MockGateway', async () => {
    const payment = service.createPaymentEntity({
      id: 'pay_100',
      projectId: 'proj_1',
      amount: 5000,
      currency: 'IRR',
      callbackUrl: 'https://app.com/cb',
      gateway: 'mock-gw',
    });

    const result = await service.initiatePayment(payment);

    expect(result.payment.status).toBe(PaymentStatus.PENDING);
    expect(result.transaction.paymentId).toBe('pay_100');
    expect(result.gatewayResponse.success).toBe(true);
    expect(result.gatewayResponse.redirectUrl).toBeDefined();
  });

  it('handles payment initiation failure from MockGateway', async () => {
    mockGw.setFailCreatePayment(true);

    const payment = service.createPaymentEntity({
      id: 'pay_101',
      projectId: 'proj_1',
      amount: 5000,
      currency: 'IRR',
      callbackUrl: 'https://app.com/cb',
      gateway: 'mock-gw',
    });

    await expect(service.initiatePayment(payment)).rejects.toThrow(GatewayError);
  });

  it('verifies payment successfully', async () => {
    const payment = service
      .createPaymentEntity({
        id: 'pay_200',
        projectId: 'proj_1',
        amount: 5000,
        currency: 'IRR',
        callbackUrl: 'https://app.com/cb',
        gateway: 'mock-gw',
      })
      .withStatus(PaymentStatus.PENDING);

    const result = await service.verifyPayment({
      payment,
      gatewayTransactionId: 'mock_tx_123',
    });

    expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
    expect(result.transaction.status).toBe(PaymentStatus.SUCCESS);
    expect(result.gatewayResponse.reference).toBeDefined();
  });

  it('inquires payment status successfully', async () => {
    const payment = service.createPaymentEntity({
      id: 'pay_300',
      projectId: 'proj_1',
      amount: 5000,
      currency: 'IRR',
      callbackUrl: 'https://app.com/cb',
      gateway: 'mock-gw',
    });

    const result = await service.inquirePayment({ payment });
    expect(result.gatewayResponse.status).toBeDefined();
  });

  it('prevents illegal status transitions in PaymentCoreService', () => {
    const payment = service
      .createPaymentEntity({
        id: 'pay_400',
        projectId: 'proj_1',
        amount: 5000,
        currency: 'IRR',
        callbackUrl: 'https://app.com/cb',
        gateway: 'mock-gw',
      })
      .withStatus(PaymentStatus.SUCCESS);

    expect(() => service.transitionStatus(payment, PaymentStatus.CREATED)).toThrow(PaymentError);
    try {
      service.transitionStatus(payment, PaymentStatus.CREATED);
    } catch (err) {
      expect(err).toBeInstanceOf(PaymentError);
      if (err instanceof PaymentError) {
        expect(err.code).toBe(ErrorCode.INVALID_STATUS_TRANSITION);
      }
    }
  });

  it('refunds and reverses payments successfully', async () => {
    const payment = service
      .createPaymentEntity({
        id: 'pay_500',
        projectId: 'proj_1',
        amount: 5000,
        currency: 'IRR',
        callbackUrl: 'https://app.com/cb',
        gateway: 'mock-gw',
      })
      .withStatus(PaymentStatus.SUCCESS);

    const refundRes = await service.refundPayment({
      payment,
      amount: 5000,
      reason: 'Customer request',
    });
    expect(refundRes.payment.status).toBe(PaymentStatus.REFUNDED);

    const reverseRes = await service.reversePayment({
      payment,
      reason: 'Duplicate payment',
    });
    expect(reverseRes.payment.status).toBe(PaymentStatus.REVERSED);
  });
});
