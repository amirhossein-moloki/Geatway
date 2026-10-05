import { GatewayCapability, Payment, PaymentStatus } from '@company/payment-core';
import { describe, expect, it } from 'vitest';
import { HttpTransport, SamanGateway } from '../src/index.js';

class MockHttpTransport implements HttpTransport {
  public postResponses: Map<string, unknown> = new Map();

  public async post<T>(url: string, _body: unknown): Promise<T> {
    for (const [key, response] of this.postResponses.entries()) {
      if (url.includes(key)) {
        return response as T;
      }
    }
    throw new Error(`Unhandled mock request for ${url}`);
  }
}

describe('SamanGateway', () => {
  const config = {
    terminalId: '12571198',
    redirectUrl: 'https://merchant.example.com/return',
  };

  it('should initialize with correct capabilities', () => {
    const gateway = new SamanGateway(config);
    expect(gateway.id).toBe('saman');
    expect(gateway.supportsCapability(GatewayCapability.CREATE_PAYMENT)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.VERIFY)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.REVERSE)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.CALLBACK)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.INQUIRY)).toBe(false);
  });

  it('should request token (create payment) successfully', async () => {
    const mockTransport = new MockHttpTransport();
    mockTransport.postResponses.set('OnlinePG', {
      status: 1,
      token: 'GmshtyjwKSsfep3pACMYisR1YsCFXdev8bpK9k365g',
    });

    const gateway = new SamanGateway(config, mockTransport);
    const payment = new Payment({
      id: 'ResNum-101',
      amount: 10000,
      currency: 'IRR',
      gateway: 'saman',
    });

    const res = await gateway.createPayment({ payment });

    expect(res.success).toBe(true);
    expect(res.gatewayTransactionId).toBe('GmshtyjwKSsfep3pACMYisR1YsCFXdev8bpK9k365g');
    expect(res.redirectUrl).toBe('https://sep.shaparak.ir/OnlinePG/SendToken');
    expect(res.status).toBe(PaymentStatus.PENDING);
  });

  it('should verify transaction successfully', async () => {
    const mockTransport = new MockHttpTransport();
    mockTransport.postResponses.set('VerifyTranscation', {
      ResultCode: 0,
      ResultDescription: 'Success',
      TransactionDetail: {
        RefNum: 'GmshtyjwKSsfep3pACMYisR1YsCFXdev8bpK9k365g',
        MaskedPan: '621986******1234',
        Rrn: '9988776655',
      },
    });

    const gateway = new SamanGateway(config, mockTransport);
    const res = await gateway.verify({
      paymentId: 'ResNum-101',
      amount: 10000,
      currency: 'IRR',
      reference: 'GmshtyjwKSsfep3pACMYisR1YsCFXdev8bpK9k365g',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe(PaymentStatus.SUCCESS);
    expect(res.reference).toBe('GmshtyjwKSsfep3pACMYisR1YsCFXdev8bpK9k365g');
    expect(res.cardMask).toBe('621986******1234');
  });

  it('should reverse transaction successfully', async () => {
    const mockTransport = new MockHttpTransport();
    mockTransport.postResponses.set('ReverseTranscation', {
      ResultCode: 0,
      ResultDescription: 'Success',
    });

    const gateway = new SamanGateway(config, mockTransport);
    const res = await gateway.reverse({
      paymentId: 'ResNum-101',
      gatewayTransactionId: 'GmshtyjwKSsfep3pACMYisR1YsCFXdev8bpK9k365g',
    });

    expect(res.success).toBe(true);
  });

  it('should parse callback body correctly', async () => {
    const gateway = new SamanGateway(config);
    const callback = await gateway.parseCallback({
      query: {},
      body: {
        State: 'OK',
        RefNum: 'GmshtyjwKSsfep3pACMYisR1YsCFXdev8bpK9k365g',
        ResNum: 'ResNum-101',
        Rrn: '9988776655',
      },
      headers: {},
    });

    expect(callback.isSuccess).toBe(true);
    expect(callback.gatewayTransactionId).toBe('GmshtyjwKSsfep3pACMYisR1YsCFXdev8bpK9k365g');
    expect(callback.paymentId).toBe('ResNum-101');
    expect(callback.reference).toBe('9988776655');
  });
});
