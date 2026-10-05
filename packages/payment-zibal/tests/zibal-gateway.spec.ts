import { GatewayCapability, Payment, PaymentStatus } from '@company/payment-core';
import { describe, expect, it } from 'vitest';
import { HttpTransport, ZibalGateway } from '../src/index.js';

class MockHttpTransport implements HttpTransport {
  public postResponses: Map<string, unknown> = new Map();
  public lastPostedUrl = '';
  public lastPostedBody: unknown = null;

  public async post<T>(url: string, body: unknown): Promise<T> {
    this.lastPostedUrl = url;
    this.lastPostedBody = body;

    for (const [key, response] of this.postResponses.entries()) {
      if (url.includes(key)) {
        return response as T;
      }
    }
    throw new Error(`Unhandled mock request for ${url}`);
  }
}

describe('ZibalGateway', () => {
  const config = {
    merchant: 'zibal',
    callbackUrl: 'https://merchant.example.com/callback',
  };

  it('should initialize correctly with config and capabilities', () => {
    const gateway = new ZibalGateway(config);
    expect(gateway.id).toBe('zibal');
    expect(gateway.displayName).toContain('Zibal');
    expect(gateway.isEnabled).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.CREATE_PAYMENT)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.VERIFY)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.INQUIRY)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.CALLBACK)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.REFUND)).toBe(false);
  });

  it('should create payment successfully', async () => {
    const mockTransport = new MockHttpTransport();
    mockTransport.postResponses.set('/v1/request', {
      trackId: 15966442233311,
      result: 100,
      message: 'success',
    });

    const gateway = new ZibalGateway(config, mockTransport);
    const payment = new Payment({
      id: 'order-123',
      amount: 100000,
      currency: 'IRR',
      gateway: 'zibal',
      description: 'Test payment',
    });

    const res = await gateway.createPayment({ payment });

    expect(res.success).toBe(true);
    expect(res.gatewayTransactionId).toBe('15966442233311');
    expect(res.redirectUrl).toBe('https://gateway.zibal.ir/start/15966442233311');
    expect(res.status).toBe(PaymentStatus.PENDING);
  });

  it('should handle payment request failure', async () => {
    const mockTransport = new MockHttpTransport();
    mockTransport.postResponses.set('/v1/request', {
      trackId: 0,
      result: 102,
      message: 'merchant not found',
    });

    const gateway = new ZibalGateway(config, mockTransport);
    const payment = new Payment({
      id: 'order-123',
      amount: 100000,
      currency: 'IRR',
      gateway: 'zibal',
    });

    await expect(gateway.createPayment({ payment })).rejects.toThrow();
  });

  it('should verify payment successfully', async () => {
    const mockTransport = new MockHttpTransport();
    mockTransport.postResponses.set('/v1/verify', {
      paidAt: '2022-07-06T14:18:21.742000',
      amount: 100000,
      result: 100,
      status: 1,
      refNumber: 12312,
      cardNumber: '62741****44',
      orderId: 'order-123',
      message: 'success',
    });

    const gateway = new ZibalGateway(config, mockTransport);
    const res = await gateway.verify({
      paymentId: 'order-123',
      amount: 100000,
      currency: 'IRR',
      gatewayTransactionId: '15966442233311',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe(PaymentStatus.SUCCESS);
    expect(res.reference).toBe('12312');
    expect(res.cardMask).toBe('62741****44');
  });

  it('should inquiry payment successfully', async () => {
    const mockTransport = new MockHttpTransport();
    mockTransport.postResponses.set('/v1/inquiry', {
      createdAt: '2022-07-06T14:17:52.918000',
      paidAt: '2022-07-06T14:18:21.742000',
      verifiedAt: '2022-07-06T14:18:21.742000',
      cardNumber: '62741****44',
      status: 1,
      amount: 100000,
      refNumber: 12312,
      orderId: 'order-123',
      result: 100,
      message: 'success',
    });

    const gateway = new ZibalGateway(config, mockTransport);
    const res = await gateway.inquiry({
      paymentId: 'order-123',
      gatewayTransactionId: '15966442233311',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe(PaymentStatus.SUCCESS);
    expect(res.amount).toBe(100000);
    expect(res.reference).toBe('12312');
  });

  it('should parse callback parameters correctly', async () => {
    const gateway = new ZibalGateway(config);
    const callback = await gateway.parseCallback({
      query: {
        trackId: '15966442233311',
        success: '1',
        status: '2',
        orderId: 'order-123',
      },
      body: {},
      headers: {},
    });

    expect(callback.isSuccess).toBe(true);
    expect(callback.gatewayTransactionId).toBe('15966442233311');
    expect(callback.paymentId).toBe('order-123');
  });
});
