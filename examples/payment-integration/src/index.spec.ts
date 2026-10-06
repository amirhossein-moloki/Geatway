import { describe, it, expect, beforeEach } from 'vitest';
import { AppController } from '../src/index.js';

describe('Payment Integration Reference Application Suite', () => {
  let controller: AppController;

  beforeEach(() => {
    controller = new AppController();
  });

  it('creates a payment successfully', async () => {
    const res = await controller.handleCreatePayment({
      gateway: 'zibal',
      amount: 100000,
      currency: 'IRR',
      description: 'Test order',
    });

    expect(res.statusCode).toBe(201);
    const body = res.body as { paymentId: string; status: string };
    expect(body.paymentId).toBeDefined();
    expect(body.status).toBe('PENDING');
  });

  it('retrieves a created payment by ID', async () => {
    const createRes = await controller.handleCreatePayment({
      gateway: 'zibal',
      amount: 50000,
      currency: 'IRR',
    });

    const createBody = createRes.body as { paymentId: string };
    const paymentId = createBody.paymentId;
    const getRes = await controller.handleGetPayment(paymentId);

    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.body as { id: string };
    expect(getBody.id).toBe(paymentId);
  });

  it('handles callback and verifies payment', async () => {
    const createRes = await controller.handleCreatePayment({
      gateway: 'zibal',
      amount: 50000,
      currency: 'IRR',
    });

    const createBody = createRes.body as { paymentId: string };
    const paymentId = createBody.paymentId;

    // Simulate callback
    const callbackRes = await controller.handleCallback('zibal', {
      query: { success: '1', trackId: '123456', orderId: paymentId },
      body: {},
      headers: {},
    });

    expect(callbackRes.statusCode).toBe(302);
  });

  it('handles invalid payment state transition during refund on un-verified payment', async () => {
    const createRes = await controller.handleCreatePayment({
      gateway: 'zibal',
      amount: 50000,
      currency: 'IRR',
    });

    const createBody = createRes.body as { paymentId: string };
    const paymentId = createBody.paymentId;

    const refundRes = await controller.handleRefundPayment(paymentId, { amount: 10000 });
    expect(refundRes.statusCode).toBe(409);
    const refundBody = refundRes.body as { error: string };
    expect(refundBody.error).toBe('InvalidPaymentState');
  });
});
