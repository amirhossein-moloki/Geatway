import { GatewayCapability, Payment, PaymentStatus } from '@company/payment-core';
import { describe, expect, it } from 'vitest';
import { HttpTransport, ZarinpalGateway } from '../src/index.js';

class MockHttpTransport implements HttpTransport {
  public response: unknown = null;
  public lastBody: unknown = null;

  public async post<T>(_url: string, body: unknown): Promise<T> {
    this.lastBody = body;
    return this.response as T;
  }
}

describe('ZarinpalGateway', () => {
  const config = {
    accessToken: 'test_token',
    merchantId: '00000000-0000-0000-0000-000000000000',
    callbackUrl: 'https://merchant.example.com/callback',
  };

  it('should initialize with correct capabilities', () => {
    const gateway = new ZarinpalGateway(config);
    expect(gateway.id).toBe('zarinpal');
    expect(gateway.supportsCapability(GatewayCapability.CREATE_PAYMENT)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.VERIFY)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.CALLBACK)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.INQUIRY)).toBe(false);
  });

  it('should create payment successfully via GraphQL', async () => {
    const mockTransport = new MockHttpTransport();
    mockTransport.response = {
      data: {
        PaymentRequest: {
          code: 100,
          authority: 'A000000000000000000000000000000000000',
          message: 'Success',
        },
      },
    };

    const gateway = new ZarinpalGateway(config, mockTransport);
    const payment = new Payment({
      id: 'order-1',
      amount: 200000,
      currency: 'IRR',
      gateway: 'zarinpal',
    });

    const res = await gateway.createPayment({ payment });

    expect(res.success).toBe(true);
    expect(res.gatewayTransactionId).toBe('A000000000000000000000000000000000000');
    expect(res.redirectUrl).toBe(
      'https://www.zarinpal.com/pg/StartPay/A000000000000000000000000000000000000',
    );
    expect(res.status).toBe(PaymentStatus.PENDING);
  });

  it('should verify payment successfully', async () => {
    const mockTransport = new MockHttpTransport();
    mockTransport.response = {
      data: {
        PaymentVerification: {
          code: 100,
          ref_id: 12345678,
          card_pan: '603799******1234',
        },
      },
    };

    const gateway = new ZarinpalGateway(config, mockTransport);
    const res = await gateway.verify({
      paymentId: 'order-1',
      amount: 200000,
      currency: 'IRR',
      gatewayTransactionId: 'A000000000000000000000000000000000000',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe(PaymentStatus.SUCCESS);
    expect(res.reference).toBe('12345678');
    expect(res.cardMask).toBe('603799******1234');
  });

  it('should parse callback query correctly', async () => {
    const gateway = new ZarinpalGateway(config);
    const callback = await gateway.parseCallback({
      query: {
        Authority: 'A000000000000000000000000000000000000',
        Status: 'OK',
      },
      body: {},
      headers: {},
    });

    expect(callback.isSuccess).toBe(true);
    expect(callback.gatewayTransactionId).toBe('A000000000000000000000000000000000000');
  });
});
