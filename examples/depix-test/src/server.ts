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
import { DepixPaymentApp } from './payment-app.js';

export function createHttpServer(app: DepixPaymentApp): http.Server {
  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;
    const method = (req.method || 'GET').toUpperCase();

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');

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

      // 3. Create Payment: POST /api/payments
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

      // 4. Callback handling: /api/callbacks/:gateway
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

      // 5. Dynamic /api/payments/:id routes
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
  if (err instanceof PaymentPlatformError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'PaymentError', message: err.message }));
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'InternalServerError', message }));
}
