# @company/payment-service

Application Integration Layer and Payment Service Orchestrator for the Payment Platform Ecosystem.

## Overview

`@company/payment-service` provides a production-grade, application-facing payment service (`PaymentApplicationService` / `PaymentService`) that orchestrates core domain entities, provider gateways, repositories, policies, idempotency, callback/webhook handling, and observability.

It keeps `@amirhossein-moloki/payment-core` completely provider-agnostic and database-agnostic while presenting developers with a clean, strongly typed API.

## Features

- **Unified Payment Lifecycle Orchestration**: Single application service for `createPayment`, `getPayment`, `inquirePayment`, `verifyPayment`, `authorizePayment`, `capturePayment`, `refundPayment` (including partial refunds), `cancelPayment`, and `reversePayment`.
- **Idempotency Protection**: Out-of-the-box operation scope isolation and SHA-256 request payload hashing via `IdempotencyOrchestrator` wrapping `IdempotencyRepository`.
- **Browser Callback & Webhook Processing**: Framework-agnostic parsing, receipt logging, event deduplication, and out-of-order state transition protection.
- **Resilience Policies**: Configurable `RetryPolicy` (bounded backoff, jitter, retryable error classification) and `TimeoutPolicy` for external provider calls.
- **Observability**: Vendor-neutral `PaymentLogger` with automatic redacting of sensitive data (card numbers, credentials, CVV, tokens).
- **Developer Experience (DX)**: Includes in-memory repository fakes (`InMemoryPaymentRepository`, `InMemoryTransactionRepository`, `InMemoryIdempotencyRepository`, `InMemoryWebhookEventRepository`), `TestGateway`, and `createTestPaymentService` helper for testing applications without real credentials.

## Installation

```bash
pnpm add @company/payment-service @amirhossein-moloki/payment-core
```

## Quick Start Example

```typescript
import { GatewayRegistry } from '@amirhossein-moloki/payment-core';
import { MellatGateway } from '@company/payment-mellat';
import { PaymentApplicationService } from '@company/payment-service';
import {
  PostgresPaymentRepository,
  PostgresTransactionRepository,
} from '@company/payment-persistence-postgres';

// 1. Initialize Gateway Registry & Gateways
const registry = new GatewayRegistry();
registry.register(new MellatGateway({ terminalId: '123', username: 'usr', password: 'pwd' }));

// 2. Instantiate Payment Application Service with Repositories
const paymentService = new PaymentApplicationService({
  registry,
  paymentRepository: new PostgresPaymentRepository(dbPool),
  transactionRepository: new PostgresTransactionRepository(dbPool),
  config: {
    defaultTimeoutMs: 10000,
    retryPolicy: { maxAttempts: 3 },
  },
});

// 3. Create Payment
const result = await paymentService.createPayment({
  gateway: 'mellat',
  amount: 250000,
  currency: 'IRR',
  callbackUrl: 'https://example.com/payments/callback',
  idempotencyKey: 'order-101-payment',
  metadata: { orderId: 'ord_101' },
});

console.log('Payment created:', result.payment.id);
console.log('Redirect user to:', result.redirectUrl);
```

## Testing Your Integrations

`@company/payment-service` exposes testing utilities in `@company/payment-service/testing` or `@company/payment-service`:

```typescript
import { createTestPaymentService } from '@company/payment-service';

describe('My E-Commerce Checkout', () => {
  it('should process checkout successfully', async () => {
    const { service } = createTestPaymentService();

    const paymentOutput = await service.createPayment({
      gateway: 'test-gateway',
      amount: 50000,
      currency: 'IRR',
      idempotencyKey: 'cart_123',
    });

    const verifyOutput = await service.verifyPayment({
      paymentId: paymentOutput.payment.id,
    });

    expect(verifyOutput.status).toBe('SUCCESS');
  });
});
```
