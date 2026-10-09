import http from 'http';
import { URL } from 'url';
import {
  PaymentPlatformError,
  ValidationError,
  GatewayNotFoundError,
  GatewayDisabledError,
  UnsupportedCapabilityError,
  InvalidPaymentStateError,
  GatewayError,
} from '@amirhossein-moloki/payment-core';
import { WalletError } from '@amirhossein-moloki/wallet-core';
import { DepixPaymentApp } from './payment-app.js';

export function createHttpServer(app: DepixPaymentApp): http.Server {
  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;
    const method = (req.method || 'GET').toUpperCase();

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Idempotency-Key, x-customer-id, x-admin-id',
    );

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // 1. Root Status Page
      if (pathname === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify(
            {
              name: 'Depix Payment Test Environment',
              status: 'running',
              environment: app.config.environment,
              useMockGateways: app.config.useMockGateways,
              registeredGateways: app.getRegisteredGateways(),
              endpoints: {
                health: 'GET /health',
                createPayment: 'POST /api/payments',
                getPayment: 'GET /api/payments/:id',
                verifyPayment: 'POST /api/payments/:id/verify',
                inquirePayment: 'GET /api/payments/:id/inquire',
                refundPayment: 'POST /api/payments/:id/refund',
                callback: 'ALL /api/callbacks/:gateway',
                getCustomerWallet: 'GET /store/me/wallet',
                initiateTopUp: 'POST /store/me/wallet/topup',
                adminCreditWallet: 'POST /admin/wallets/:id/credit',
                adminDebitWallet: 'POST /admin/wallets/:id/debit',
                walletCheckout: 'POST /api/payments/wallet-checkout',
              },
            },
            null,
            2,
          ),
        );
        return;
      }

      // 2. Health Check
      if (pathname === '/health' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', gateways: app.getRegisteredGateways() }));
        return;
      }

      // Parse JSON body for POST/PUT requests
      let body: Record<string, unknown> = {};
      if (method === 'POST' || method === 'PUT') {
        const rawBody = await readRequestBody(req);
        if (rawBody.trim().length > 0) {
          try {
            body = JSON.parse(rawBody);
          } catch {
            // If body is URL encoded
            const params = new URLSearchParams(rawBody);
            for (const [key, val] of params.entries()) {
              body[key] = val;
            }
          }
        }
      }

      // 3. Customer Wallet: GET /store/me/wallet
      if (pathname === '/store/me/wallet' && method === 'GET') {
        const customerId =
          (req.headers['x-customer-id'] as string) ||
          (reqUrl.searchParams.get('customerId') as string);
        if (!customerId || customerId.trim() === '') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ error: 'Unauthorized', message: 'Missing x-customer-id header' }),
          );
          return;
        }

        const currency = (reqUrl.searchParams.get('currency') as string) || 'IRR';
        const { wallet, balance } = await app.walletModuleService.getCustomerWallet(
          customerId,
          currency,
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            walletId: wallet.id,
            ownerId: wallet.ownerId,
            currency: wallet.currency,
            status: wallet.status,
            balance: balance.amount.toString(),
          }),
        );
        return;
      }

      // 4. Customer Wallet Top-Up Initiation: POST /store/me/wallet/topup
      if (pathname === '/store/me/wallet/topup' && method === 'POST') {
        const customerId = (req.headers['x-customer-id'] as string) || (body.customerId as string);
        if (!customerId || customerId.trim() === '') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ error: 'Unauthorized', message: 'Missing x-customer-id header' }),
          );
          return;
        }

        const gateway = (body.gateway as string) || 'zibal';
        const amount = Number(body.amount) || 100000;
        const currency = (body.currency as string) || 'IRR';
        const idempotencyKey =
          (req.headers['idempotency-key'] as string) ||
          (body.idempotencyKey as string) ||
          undefined;

        const { wallet } = await app.walletModuleService.getCustomerWallet(customerId, currency);

        // Initiate payment with gateway
        const result = await app.service.createPayment({
          gateway,
          amount,
          currency,
          description: `Top-up for wallet ${wallet.id}`,
          idempotencyKey,
          metadata: {
            walletId: wallet.id,
            customerId,
            type: 'WALLET_TOPUP',
          },
        });

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            walletId: wallet.id,
            paymentId: result.payment.id,
            status: result.status,
            redirectUrl: result.redirectUrl,
            message: 'Top-up payment initiated. Wallet will be credited upon verified callback.',
          }),
        );
        return;
      }

      // 5. Admin Wallet Operations: POST /admin/wallets/:id/credit & debit
      if (pathname.startsWith('/admin/wallets/')) {
        const parts = pathname.replace('/admin/wallets/', '').split('/');
        const walletId = parts[0];
        const action = parts[1];

        const adminId = req.headers['x-admin-id'] as string;
        if (!adminId || adminId.trim() === '') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden', message: 'Missing x-admin-id header' }));
          return;
        }

        if (action === 'credit' && method === 'POST') {
          const reason = body.reason as string;
          const idempotencyKey =
            (req.headers['idempotency-key'] as string) || (body.idempotencyKey as string);
          const amount = Number(body.amount);
          const currency = (body.currency as string) || 'IRR';

          if (!reason) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ValidationError', message: 'Reason is required' }));
            return;
          }

          const tx = await app.walletModuleService.adminCreditWallet({
            walletId,
            amountMinor: amount,
            currency,
            reason,
            adminId,
            idempotencyKey,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              transactionId: tx.id,
              walletId,
              status: tx.status,
            }),
          );
          return;
        }

        if (action === 'debit' && method === 'POST') {
          const reason = body.reason as string;
          const idempotencyKey =
            (req.headers['idempotency-key'] as string) || (body.idempotencyKey as string);
          const amount = Number(body.amount);
          const currency = (body.currency as string) || 'IRR';

          if (!reason) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ValidationError', message: 'Reason is required' }));
            return;
          }

          const tx = await app.walletModuleService.adminDebitWallet({
            walletId,
            amountMinor: amount,
            currency,
            reason,
            adminId,
            idempotencyKey,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              transactionId: tx.id,
              walletId,
              status: tx.status,
            }),
          );
          return;
        }
      }

      // 6. Wallet Checkout: POST /api/payments/wallet-checkout
      if (pathname === '/api/payments/wallet-checkout' && method === 'POST') {
        const walletId = body.walletId as string;
        const amount = Number(body.amount);
        const currency = (body.currency as string) || 'IRR';
        const orderId = body.orderId as string;
        const idempotencyKey =
          (req.headers['idempotency-key'] as string) || (body.idempotencyKey as string);

        const result = await app.walletPaymentProvider.authorizePayment(
          { walletId, amount: amount.toString(), currency },
          idempotencyKey,
          orderId,
        );

        if (result.status === 'error') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: result.error }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...result }));
        return;
      }

      // 7. Create Payment: POST /api/payments
      if (pathname === '/api/payments' && method === 'POST') {
        const idempotencyKey =
          (req.headers['idempotency-key'] as string) ||
          (body.idempotencyKey as string) ||
          undefined;

        const result = await app.service.createPayment({
          gateway: (body.gateway as string) || 'zibal',
          amount: Number(body.amount) || 10000,
          currency: (body.currency as string) || 'IRR',
          description: (body.description as string) || 'Depix test payment',
          idempotencyKey,
        });

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            paymentId: result.payment.id,
            status: result.status,
            redirectUrl: result.redirectUrl,
            actionUrl: result.actionUrl,
            action: result.action,
            gatewayTransactionId: result.gatewayTransactionId,
          }),
        );
        return;
      }

      // 8. Callback handling: /api/callbacks/:gateway
      if (pathname.startsWith('/api/callbacks/')) {
        const gateway = pathname.replace('/api/callbacks/', '');
        const query = Object.fromEntries(reqUrl.searchParams.entries());

        const callbackReq = {
          query,
          body,
          headers: req.headers as Record<string, string | string[] | undefined>,
        };

        const callbackResult = await app.service.handleCallback(gateway, callbackReq);

        let verifyResult = null;
        if (callbackResult.isSuccess && callbackResult.paymentId) {
          verifyResult = await app.service.verifyPayment({
            paymentId: callbackResult.paymentId,
            gatewayTransactionId: callbackResult.gatewayTransactionId,
            reference: callbackResult.reference,
            callbackData: callbackResult.rawData,
          });

          // Check if payment was a wallet top-up and credit wallet upon verified payment
          const payment = await app.service.getPayment(callbackResult.paymentId);
          if (payment && payment.metadata?.type === 'WALLET_TOPUP' && payment.metadata?.walletId) {
            const walletId = payment.metadata.walletId as string;
            await app.walletModuleService.topUpWallet({
              walletId,
              amountMinor: payment.amount,
              currency: payment.currency,
              reference: payment.id,
              idempotencyKey: `topup_verify_${payment.id}`,
            });
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            gateway,
            callback: callbackResult,
            verification: verifyResult,
          }),
        );
        return;
      }

      // 9. Dynamic /api/payments/:id routes
      if (pathname.startsWith('/api/payments/')) {
        const parts = pathname.replace('/api/payments/', '').split('/');
        const paymentId = parts[0];
        const subAction = parts[1];

        if (!paymentId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing paymentId' }));
          return;
        }

        // GET /api/payments/:id
        if (!subAction && method === 'GET') {
          const payment = await app.service.getPayment(paymentId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payment));
          return;
        }

        // POST /api/payments/:id/verify
        if (subAction === 'verify' && method === 'POST') {
          const result = await app.service.verifyPayment({
            paymentId,
            gatewayTransactionId: body.gatewayTransactionId as string | undefined,
            reference: body.reference as string | undefined,
          });

          const payment = await app.service.getPayment(paymentId);
          if (payment && payment.metadata?.type === 'WALLET_TOPUP' && payment.metadata?.walletId) {
            const walletId = payment.metadata.walletId as string;
            await app.walletModuleService.topUpWallet({
              walletId,
              amountMinor: payment.amount,
              currency: payment.currency,
              reference: payment.id,
              idempotencyKey: `topup_verify_${payment.id}`,
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // GET /api/payments/:id/inquire
        if (subAction === 'inquire' && method === 'GET') {
          const result = await app.service.inquirePayment(paymentId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // POST /api/payments/:id/refund
        if (subAction === 'refund' && method === 'POST') {
          const result = await app.service.refundPayment({
            paymentId,
            amount: body.amount ? Number(body.amount) : undefined,
            reason: body.reason as string | undefined,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }
      }

      // 404 Not Found
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found', path: pathname }));
    } catch (err) {
      handleServerError(res, err);
    }
  });
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', (err) => reject(err));
  });
}

function handleServerError(res: http.ServerResponse, err: unknown) {
  if (err instanceof ValidationError) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'ValidationError', message: err.message }));
    return;
  }
  if (err instanceof GatewayNotFoundError || err instanceof GatewayDisabledError) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'GatewayNotFound', message: err.message }));
    return;
  }
  if (err instanceof UnsupportedCapabilityError) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'UnsupportedCapability', message: err.message }));
    return;
  }
  if (err instanceof InvalidPaymentStateError) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'InvalidPaymentState', message: err.message }));
    return;
  }
  if (err instanceof GatewayError) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'GatewayError', code: err.code, message: err.message }));
    return;
  }
  if (err instanceof WalletError) {
    res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'WalletError', message: err.message }));
    return;
  }
  if (err instanceof PaymentPlatformError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'PaymentError', message: err.message }));
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'InternalServerError', message }));
}
