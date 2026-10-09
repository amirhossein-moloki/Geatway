import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { DepixPaymentApp } from '../src/payment-app.js';
import { createHttpServer } from '../src/server.js';

describe('Depix Test Wallet Integration API Suite', () => {
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

  describe('Customer Wallet APIs', () => {
    it('rejects GET /store/me/wallet without x-customer-id header', async () => {
      const res = await fetch(`${serverUrl}/store/me/wallet`);
      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('Unauthorized');
    });

    it('provisions and retrieves customer wallet and balance on GET /store/me/wallet', async () => {
      const res = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_100' },
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        walletId: string;
        ownerId: string;
        currency: string;
        balance: string;
      };
      expect(data.ownerId).toBe('cust_http_100');
      expect(data.currency).toBe('IRR');
      expect(data.balance).toBe('0');
    });

    it('initiates wallet top-up without immediate credit, and credits wallet on verified payment', async () => {
      // 1. Get wallet
      const walletRes = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_topup' },
      });
      const walletData = (await walletRes.json()) as { walletId: string; balance: string };
      expect(walletData.balance).toBe('0');

      // 2. Initiate Top-Up
      const topupRes = await fetch(`${serverUrl}/store/me/wallet/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_http_topup',
        },
        body: JSON.stringify({
          gateway: 'zibal',
          amount: 500000,
          currency: 'IRR',
        }),
      });

      expect(topupRes.status).toBe(201);
      const topupData = (await topupRes.json()) as {
        success: boolean;
        paymentId: string;
        walletId: string;
      };
      expect(topupData.success).toBe(true);
      expect(topupData.paymentId).toBeDefined();

      // Confirm wallet NOT credited immediately
      const check1 = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_topup' },
      });
      const check1Data = (await check1.json()) as { balance: string };
      expect(check1Data.balance).toBe('0');

      // 3. Verify Payment
      const verifyRes = await fetch(`${serverUrl}/api/payments/${topupData.paymentId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayTransactionId: 'gtx_topup_1', reference: 'ref_topup_1' }),
      });
      expect(verifyRes.status).toBe(200);

      // Confirm wallet IS credited now
      const check2 = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_topup' },
      });
      const check2Data = (await check2.json()) as { balance: string };
      expect(check2Data.balance).toBe('500000');
    });
  });

  describe('Administrative Wallet APIs', () => {
    it('rejects admin credit without x-admin-id header', async () => {
      const res = await fetch(`${serverUrl}/admin/wallets/wlt_dummy/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000, currency: 'IRR', reason: 'Test' }),
      });
      expect(res.status).toBe(403);
    });

    it('performs authorized admin credit and debit', async () => {
      // Provision wallet
      const walletRes = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_admin_test' },
      });
      const walletData = (await walletRes.json()) as { walletId: string };

      // Admin Credit
      const creditRes = await fetch(`${serverUrl}/admin/wallets/${walletData.walletId}/credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': 'admin_super',
        },
        body: JSON.stringify({
          amount: 1000000,
          currency: 'IRR',
          reason: 'Goodwill bonus',
          idempotencyKey: 'idemp_adm_cred_http_1',
        }),
      });
      expect(creditRes.status).toBe(200);
      const creditData = (await creditRes.json()) as { success: boolean; transactionId: string };
      expect(creditData.success).toBe(true);

      // Check balance
      let check = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_admin_test' },
      });
      expect(((await check.json()) as { balance: string }).balance).toBe('1000000');

      // Admin Debit
      const debitRes = await fetch(`${serverUrl}/admin/wallets/${walletData.walletId}/debit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': 'admin_super',
        },
        body: JSON.stringify({
          amount: 300000,
          currency: 'IRR',
          reason: 'Correction',
          idempotencyKey: 'idemp_adm_deb_http_1',
        }),
      });
      expect(debitRes.status).toBe(200);

      // Check balance again
      check = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_admin_test' },
      });
      expect(((await check.json()) as { balance: string }).balance).toBe('700000');
    });
  });

  describe('Wallet Checkout API', () => {
    it('executes checkout payment from wallet balance and rejects when balance is insufficient', async () => {
      // Provision wallet and add funds
      const walletRes = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_checkout' },
      });
      const walletData = (await walletRes.json()) as { walletId: string };

      await fetch(`${serverUrl}/admin/wallets/${walletData.walletId}/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': 'admin_test' },
        body: JSON.stringify({
          amount: 400000,
          currency: 'IRR',
          reason: 'Fund wallet',
          idempotencyKey: 'idemp_fund_chk',
        }),
      });

      // Checkout attempt for 300000 (Sufficient balance)
      const chk1 = await fetch(`${serverUrl}/api/payments/wallet-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: walletData.walletId,
          amount: 300000,
          currency: 'IRR',
          orderId: 'order_http_001',
          idempotencyKey: 'idemp_order_http_001',
        }),
      });
      expect(chk1.status).toBe(200);
      const chk1Data = (await chk1.json()) as { success: boolean; status: string };
      expect(chk1Data.success).toBe(true);
      expect(chk1Data.status).toBe('authorized');

      // Check remaining balance (should be 100000)
      const checkBal = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_checkout' },
      });
      expect(((await checkBal.json()) as { balance: string }).balance).toBe('100000');

      // Checkout attempt for 200000 (Insufficient balance)
      const chk2 = await fetch(`${serverUrl}/api/payments/wallet-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: walletData.walletId,
          amount: 200000,
          currency: 'IRR',
          orderId: 'order_http_002',
          idempotencyKey: 'idemp_order_http_002',
        }),
      });
      expect(chk2.status).toBe(400);
      const chk2Data = (await chk2.json()) as { success: boolean; error: string };
      expect(chk2Data.success).toBe(false);
      expect(chk2Data.error).toContain('Insufficient wallet balance');
    });

    it('ensures wallet checkout idempotency over HTTP', async () => {
      // Provision wallet and add funds
      const walletRes = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_idemp' },
      });
      const walletData = (await walletRes.json()) as { walletId: string };

      await fetch(`${serverUrl}/admin/wallets/${walletData.walletId}/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': 'admin_test' },
        body: JSON.stringify({
          amount: 500000,
          currency: 'IRR',
          reason: 'Fund for idempotency test',
          idempotencyKey: 'idemp_fund_http_idemp',
        }),
      });

      const bodyData = {
        walletId: walletData.walletId,
        amount: 200000,
        currency: 'IRR',
        orderId: 'order_http_idemp_1',
        idempotencyKey: 'idemp_key_http_chk_1',
      };

      // Call 1
      const res1 = await fetch(`${serverUrl}/api/payments/wallet-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      expect(res1.status).toBe(200);

      // Call 2 with exact same idempotencyKey
      const res2 = await fetch(`${serverUrl}/api/payments/wallet-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      expect(res2.status).toBe(200);

      // Check balance (500000 - 200000 = 300000)
      const checkBal = await fetch(`${serverUrl}/store/me/wallet`, {
        headers: { 'x-customer-id': 'cust_http_idemp' },
      });
      expect(((await checkBal.json()) as { balance: string }).balance).toBe('300000');
    });
  });
});
