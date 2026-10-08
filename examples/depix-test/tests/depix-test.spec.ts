import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { DepixPaymentApp } from '../src/payment-app.js';
import { createHttpServer } from '../src/server.js';

describe('Depix Test Application Integration Suite', () => {
  let app: DepixPaymentApp;
  let server: http.Server;
  let serverUrl: string;

  beforeAll(async () => {
    app = new DepixPaymentApp({ useMockGateways: true, environment: 'test' });
    server = createHttpServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as { port: number };
        serverUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('registers Zibal payment gateway', () => {
    const gateways = app.getRegisteredGateways();
    expect(gateways).toEqual(['zibal']);
  });

  it('returns status info on GET /', async () => {
    const res = await fetch(`${serverUrl}/`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      name: string;
      status: string;
      registeredGateways: string[];
    };
    expect(body.name).toBe('Depix Payment Test Environment');
    expect(body.status).toBe('running');
    expect(body.registeredGateways).toEqual(['zibal']);
  });

  it('returns health status on GET /health', async () => {
    const res = await fetch(`${serverUrl}/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; gateways: string[] };
    expect(body.status).toBe('ok');
    expect(body.gateways).toEqual(['zibal']);
  });

  it('executes end-to-end payment creation and verification via HTTP API for Zibal', async () => {
    const gateways = ['zibal'];

    for (const gateway of gateways) {
      // 1. Create Payment
      const createRes = await fetch(`${serverUrl}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway,
          amount: 150000,
          currency: 'IRR',
          description: `Integration test for ${gateway}`,
        }),
      });

      expect(createRes.status).toBe(201);
      const createData = (await createRes.json()) as {
        success: boolean;
        paymentId: string;
        status: string;
      };
      expect(createData.success).toBe(true);
      expect(createData.paymentId).toBeDefined();

      const paymentId = createData.paymentId;

      // 2. Get Payment Status
      const getRes = await fetch(`${serverUrl}/api/payments/${paymentId}`);
      expect(getRes.status).toBe(200);
      const getPayment = (await getRes.json()) as { id: string; gateway?: string; amount: number };
      expect(getPayment.id).toBe(paymentId);
      expect(getPayment.gateway).toBe(gateway);

      // 3. Callback Handling
      const callbackRes = await fetch(
        `${serverUrl}/api/callbacks/${gateway}?paymentId=${paymentId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId: '123456', success: '1', status: '2' }),
        },
      );
      expect(callbackRes.status).toBe(200);

      // 4. Manual Verification
      const verifyRes = await fetch(`${serverUrl}/api/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayTransactionId: 'tx_mock_123', reference: 'ref_mock_123' }),
      });
      expect(verifyRes.status).toBe(200);
      const verifyData = (await verifyRes.json()) as { status: string };
      expect(verifyData.status).toBe('SUCCESS');

      // 5. Inquire Payment
      const inquireRes = await fetch(`${serverUrl}/api/payments/${paymentId}/inquire`);
      expect(inquireRes.status).toBe(200);
      const inquireData = (await inquireRes.json()) as { status: string };
      expect(inquireData.status).toBe('SUCCESS');
    }
  });

  it('handles idempotency properly on payment creation', async () => {
    const idempotencyKey = `idem-key-${Date.now()}`;

    const res1 = await fetch(`${serverUrl}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        gateway: 'zibal',
        amount: 200000,
        currency: 'IRR',
      }),
    });

    const res2 = await fetch(`${serverUrl}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        gateway: 'zibal',
        amount: 200000,
        currency: 'IRR',
      }),
    });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const data1 = (await res1.json()) as { paymentId: string };
    const data2 = (await res2.json()) as { paymentId: string };

    expect(data1.paymentId).toBe(data2.paymentId);
  });
});
