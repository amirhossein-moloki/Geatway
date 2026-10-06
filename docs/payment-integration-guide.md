# Payment Package Ecosystem — Integration Guide

Welcome to the Payment Package Ecosystem integration guide. This document provides an end-to-end reference for integrating our modular, capability-based payment libraries into your Node.js / TypeScript backend application.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Package Installation](#3-package-installation)
4. [Package Selection](#4-package-selection)
5. [Configuration](#5-configuration)
6. [Environment Variables](#6-environment-variables)
7. [Gateway Registration](#7-gateway-registration)
8. [Payment Creation Flow](#8-payment-creation-flow)
9. [Redirect Flow](#9-redirect-flow)
10. [Callback Integration](#10-callback-integration)
11. [Verification](#11-verification)
12. [Inquiry](#12-inquiry)
13. [Refund](#13-refund)
14. [Reverse / Cancel](#14-reverse--cancel)
15. [Webhook Integration](#15-webhook-integration)
16. [Idempotency](#16-idempotency)
17. [Error Handling](#17-error-handling)
18. [Transactions](#18-transactions)
19. [Persistence Integration](#19-persistence-integration)
20. [Sandbox Mode](#20-sandbox-mode)
21. [Production Checklist](#21-production-checklist)
22. [REST API Integration](#22-rest-api-integration)
23. [OpenAPI Integration](#23-openapi-integration)
24. [Logging & Observability](#24-logging--observability)
25. [Testing Strategy](#25-testing-strategy)
26. [Troubleshooting](#26-troubleshooting)
27. [Security Guidelines](#27-security-guidelines)
28. [Common Developer Mistakes](#28-common-developer-mistakes)
29. [Upgrade Strategy](#29-upgrade-strategy)
30. [Complete Integration Example](#30-complete-integration-example)

---

## 1. Overview

The Payment Package Ecosystem is a modular set of TypeScript libraries for processing payment transactions across multiple payment service providers (PSPs).

Key design principles:

- **Provider Agnostic Core**: Core domain logic and gateway contracts are defined in `@company/payment-core`.
- **Capability-Based Gateways**: Gateways explicitly declare supported capabilities (e.g., `CREATE_PAYMENT`, `VERIFY`, `INQUIRY`, `REFUND`, `REVERSE`, `CANCEL`, `CALLBACK`, `WEBHOOK`).
- **Separation of Concerns**: Payment packages do **not** expose HTTP routes or REST APIs directly. Your application owns the REST endpoints, controllers, and OpenAPI contracts.
- **Application Integration Layer**: `@company/payment-service` provides orchestration, retry handling, timeout management, idempotency enforcement, and webhook deduplication.

---

## 2. Architecture

The payment architecture separates responsibilities into clear layers:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Main Application                         │
│   (Express / Fastify / NestJS / Custom Controllers)         │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
    HTTP Requests / Responses          OpenAPI Spec (openapi.yml)
               │                              │
┌──────────────▼──────────────────────────────▼───────────────┐
│            Application Integration Layer                    │
│             (@company/payment-service)                      │
│   - PaymentApplicationService                               │
│   - Idempotency & Retry Policies                            │
│   - Webhook & Callback Processing                           │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐  ┌────────────▼──────────────┐
│    @company/payment-core    │  │  Persistence Implementation│
│  - GatewayRegistry          │  │ @company/payment-        │
│  - Entities & Contracts     │  │  persistence-postgres    │
│  - Normalized Errors        │  │  (or In-Memory Repos)     │
└──────────────┬──────────────┘  └──────────────────────────┘
               │
 ┌─────────────┼────────────────┬──────────────┐
 │             │                │              │
 ▼             ▼                ▼              ▼
payment-mellat payment-zibal payment-zarinpal payment-saman
```

### Layer Responsibilities

1. **Main Application**: Handles HTTP routing, request parsing, response mapping, authentication, and maintains `openapi.yml`.
2. **Application Service (`@company/payment-service`)**: Orchestrates gateway execution, manages transactions, enforces idempotency, logs events, and interacts with repositories.
3. **Core (`@company/payment-core`)**: Provides entities (`Payment`, `Transaction`, `IdempotencyRecord`, `WebhookEvent`), gateway interfaces (`PaymentGateway`, `CanCreatePayment`, etc.), error types, and `GatewayRegistry`.
4. **Provider Packages**: Implements PSP-specific HTTP communication and payload mappings (e.g., `@company/payment-mellat`).
5. **Persistence (`@company/payment-persistence-postgres`)**: Implements database repositories for PostgreSQL or custom backends.

---

## 3. Package Installation

Install only `@company/payment-core`, `@company/payment-service`, and the specific PSP packages your application requires:

```bash
# Core package and service orchestration
pnpm add @company/payment-core @company/payment-service

# Install desired payment gateways
pnpm add @company/payment-mellat @company/payment-zibal

# Optional: PostgreSQL persistence package
pnpm add @company/payment-persistence-postgres
```

_Note: Installing `@company/payment-core` alone does NOT automatically include gateway providers. Gateways must be installed and registered explicitly._

---

## 4. Package Selection

When selecting packages:

- Installing `@company/payment-mellat` enables Mellat PSP support (`'mellat'`).
- Installing `@company/payment-zibal` enables Zibal gateway support (`'zibal'`).
- If your application calls a gateway that has not been registered, `PaymentApplicationService` will throw a `GatewayNotFoundError`.
- If an operation is attempted on a gateway that lacks the capability (e.g. attempting refund on Zibal), an `UnsupportedCapabilityError` is thrown.

---

## 5. Configuration

Configuration is structured per package.

### Application Service Configuration

```ts
import { PaymentServiceConfig } from '@company/payment-service';

const serviceConfig: PaymentServiceConfig = {
  defaultTimeoutMs: 10000,
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 200,
    backoffFactor: 2,
  },
};
```

### Provider Configuration Examples

#### Mellat (`@company/payment-mellat`)

```ts
import { MellatConfig } from '@company/payment-mellat';

const mellatConfig: MellatConfig = {
  gatewayId: 'mellat', // Default is 'mellat'
  terminalId: Number(process.env.MELLAT_TERMINAL_ID),
  userName: process.env.MELLAT_USERNAME!,
  userPassword: process.env.MELLAT_PASSWORD!,
  callbackUrl: process.env.MELLAT_CALLBACK_URL!,
  environment: (process.env.PAYMENT_ENV as 'sandbox' | 'production') || 'production',
};
```

#### Zibal (`@company/payment-zibal`)

```ts
import { ZibalConfig } from '@company/payment-zibal';

const zibalConfig: ZibalConfig = {
  gatewayId: 'zibal',
  merchant: process.env.ZIBAL_MERCHANT || 'zibal', // 'zibal' for sandbox mode
  callbackUrl: process.env.ZIBAL_CALLBACK_URL!,
  environment: (process.env.PAYMENT_ENV as 'sandbox' | 'production') || 'sandbox',
};
```

#### Zarinpal (`@company/payment-zarinpal`)

```ts
import { ZarinpalConfig } from '@company/payment-zarinpal';

const zarinpalConfig: ZarinpalConfig = {
  gatewayId: 'zarinpal',
  accessToken: process.env.ZARINPAL_ACCESS_TOKEN!,
  merchantId: process.env.ZARINPAL_MERCHANT_ID!,
  callbackUrl: process.env.ZARINPAL_CALLBACK_URL!,
  environment: (process.env.PAYMENT_ENV as 'sandbox' | 'production') || 'sandbox',
};
```

#### Saman (`@company/payment-saman`)

```ts
import { SamanConfig } from '@company/payment-saman';

const samanConfig: SamanConfig = {
  gatewayId: 'saman',
  terminalId: process.env.SAMAN_TERMINAL_ID!,
  redirectUrl: process.env.SAMAN_CALLBACK_URL!,
  environment: (process.env.PAYMENT_ENV as 'sandbox' | 'production') || 'sandbox',
};
```

---

## 6. Environment Variables

Store all credentials and configuration in environment variables.

Example `.env` file:

```env
PAYMENT_ENV=sandbox

# Mellat Credentials
MELLAT_TERMINAL_ID=1234567
MELLAT_USERNAME=my_username
MELLAT_PASSWORD=my_password
MELLAT_CALLBACK_URL=https://api.example.com/api/v1/payments/callback/mellat

# Zibal Credentials
ZIBAL_MERCHANT=zibal
ZIBAL_CALLBACK_URL=https://api.example.com/api/v1/payments/callback/zibal

# Zarinpal Credentials
ZARINPAL_ACCESS_TOKEN=my_zarinpal_token
ZARINPAL_MERCHANT_ID=46018260-8c88-11e5-80c7-000c295eb8fc
ZARINPAL_CALLBACK_URL=https://api.example.com/api/v1/payments/callback/zarinpal

# Saman Credentials
SAMAN_TERMINAL_ID=10293847
SAMAN_CALLBACK_URL=https://api.example.com/api/v1/payments/callback/saman
```

---

## 7. Gateway Registration

Gateways are registered in a `GatewayRegistry` instance from `@company/payment-core`:

```ts
import { GatewayRegistry } from '@company/payment-core';
import { MellatGateway } from '@company/payment-mellat';
import { ZibalGateway } from '@company/payment-zibal';

const registry = new GatewayRegistry();

// Register Mellat
const mellatGateway = new MellatGateway({
  terminalId: 1234567,
  userName: 'user',
  userPassword: 'password',
  callbackUrl: 'https://example.com/callback/mellat',
  environment: 'production',
});
registry.register(mellatGateway);

// Register Zibal
const zibalGateway = new ZibalGateway({
  merchant: 'zibal',
  callbackUrl: 'https://example.com/callback/zibal',
  environment: 'sandbox',
});
registry.register(zibalGateway);
```

---

## 8. Payment Creation Flow

To initiate a payment, call `paymentService.createPayment`:

```ts
import { PaymentApplicationService } from '@company/payment-service';

const result = await paymentService.createPayment({
  gateway: 'mellat',
  amount: 100000, // 100,000 IRR
  currency: 'IRR',
  callbackUrl: 'https://example.com/callback/mellat',
  description: 'Order #1001 payment',
  idempotencyKey: 'order_1001_attempt_1',
});

console.log('Created Payment ID:', result.payment.id);
console.log('Payment Status:', result.status); // PaymentStatus.PENDING
console.log('Redirect URL / Form Data:', result.redirectUrl || result.action);
```

---

## 9. Redirect Flow

Most Iranian PSPs require the customer's browser to be redirected or POSTed to a gateway page.

- **URL Redirect** (e.g., Zibal, Zarinpal): `result.redirectUrl` contains a URL (e.g. `https://gateway.zibal.ir/start/12345`). Direct the user via HTTP 302/303 redirect.
- **POST Redirect** (e.g., Mellat, Saman): `result.action` or `result.actionUrl` contains form parameters (`RefId`, action URL). The frontend or backend renders an HTML auto-submitting form.

---

## 10. Callback Integration

When the user completes payment on the PSP bank page, the PSP posts a callback request to your application's callback HTTP endpoint.

### Handling Callback in your Express/Fastify Controller

```ts
app.post('/api/v1/payments/callback/:gateway', async (req, res) => {
  const { gateway } = req.params;

  // 1. Parse callback payload through paymentService
  const callbackResult = await paymentService.handleCallback(gateway, {
    query: req.query as Record<string, unknown>,
    body: req.body as Record<string, unknown>,
    headers: req.headers as Record<string, string>,
  });

  if (!callbackResult.paymentId) {
    return res.status(400).send('Invalid callback payload');
  }

  // 2. Perform verification if bank reported success
  if (callbackResult.isSuccess) {
    const verifyResult = await paymentService.verifyPayment({
      paymentId: callbackResult.paymentId,
      gatewayTransactionId: callbackResult.gatewayTransactionId,
      reference: callbackResult.reference,
      callbackData: callbackResult.rawData,
    });

    if (verifyResult.status === 'SUCCESS') {
      return res.redirect(`/payment/success?id=${callbackResult.paymentId}`);
    }
  }

  return res.redirect(`/payment/failed?id=${callbackResult.paymentId}`);
});
```

---

## 11. Verification

**Crucial Security Rule**: Never treat a callback alone as proof of payment completion. You **must** call `verifyPayment` to confirm the transaction with the provider.

```ts
const verifyResult = await paymentService.verifyPayment({
  paymentId: 'pmt_123456',
  gatewayTransactionId: '1234567890',
  reference: '987654321',
});

if (verifyResult.status === 'SUCCESS') {
  console.log('Payment verified successfully!');
}
```

_Short-Circuit Protection_: If a payment is already in `SUCCESS` state, `PaymentApplicationService.verifyPayment` safely short-circuits and returns the existing successful verification transaction without re-querying the bank.

---

## 12. Inquiry

For gateways supporting remote status inquiry (Mellat, Zibal), call `inquirePayment` to check the current remote status of a transaction:

```ts
const inquiryResult = await paymentService.inquirePayment('pmt_123456');

console.log('Remote payment status:', inquiryResult.status);
```

---

## 13. Refund

For providers supporting online refunds (e.g. Mellat):

```ts
const refundResult = await paymentService.refundPayment({
  paymentId: 'pmt_123456',
  amount: 50000, // Partial or full refund
  reason: 'Customer requested cancellation',
});

console.log('Refund status:', refundResult.status); // REFUNDED or PARTIALLY_REFUNDED
console.log('Amount refunded:', refundResult.amountRefunded);
```

_Capability check_: If attempted on a provider without `REFUND` capability (e.g. Zarinpal, Zibal), an `UnsupportedCapabilityError` is thrown.

---

## 14. Reverse / Cancel

- **Reverse**: Cancels an un-verified transaction on gateways supporting reversal (e.g., Mellat, Saman).

```ts
const reverseResult = await paymentService.reversePayment({
  paymentId: 'pmt_123456',
  reason: 'Transaction cancelled before verification',
});
```

- **Cancel**: Cancels an active payment pre-authorization (where `AUTHORIZE` capability is used).

```ts
const cancelResult = await paymentService.cancelPayment({
  paymentId: 'pmt_123456',
  reason: 'Authorization released',
});
```

---

## 15. Webhook Integration

For gateways sending asynchronous server-to-server HTTP webhooks:

```ts
app.post('/api/v1/webhooks/:gateway', async (req, res) => {
  const { gateway } = req.params;

  const result = await paymentService.handleWebhook(gateway, {
    query: req.query as Record<string, unknown>,
    body: req.body as Record<string, unknown>,
    headers: req.headers as Record<string, string>,
  });

  if (result.isDuplicate) {
    console.log('Duplicate webhook received and ignored');
  } else {
    console.log(`Processed webhook event: ${result.eventType}`);
  }

  res.status(200).json({ status: 'ok' });
});
```

The service handles automatic deduplication via `WebhookEventRepository`.

---

## 16. Idempotency

`PaymentApplicationService` integrates `IdempotencyOrchestrator` to prevent duplicate operations when retried with the same `idempotencyKey`.

```ts
const result1 = await paymentService.createPayment({
  gateway: 'zibal',
  amount: 50000,
  currency: 'IRR',
  idempotencyKey: 'checkout_session_88192',
});

// Re-sending with the same key returns the exact cached result without duplicate charges
const result2 = await paymentService.createPayment({
  gateway: 'zibal',
  amount: 50000,
  currency: 'IRR',
  idempotencyKey: 'checkout_session_88192',
});
```

---

## 17. Error Handling

All core errors inherit from `PaymentPlatformError` in `@company/payment-core`.

```ts
import {
  PaymentPlatformError,
  ValidationError,
  GatewayNotFoundError,
  GatewayDisabledError,
  UnsupportedCapabilityError,
  InvalidPaymentStateError,
  GatewayError,
} from '@company/payment-core';

try {
  await paymentService.createPayment(...);
} catch (err) {
  if (err instanceof ValidationError) {
    // Bad request parameters (400)
  } else if (err instanceof GatewayNotFoundError || err instanceof GatewayDisabledError) {
    // Requested gateway unavailable (404 / 503)
  } else if (err instanceof UnsupportedCapabilityError) {
    // Gateway does not support requested capability (400 / 501)
  } else if (err instanceof InvalidPaymentStateError) {
    // Conflict state transition (409)
  } else if (err instanceof GatewayError) {
    // Provider specific error code/message
    console.error(`Gateway error [${err.code}]: ${err.message}`);
  } else if (err instanceof PaymentPlatformError) {
    // General payment platform error
  }
}
```

---

## 18. Transactions

Each payment lifecycle event generates an immutable `Transaction` domain entity recording details:

- `TransactionType.PAYMENT` (Initial request)
- `TransactionType.VERIFY` (Verification)
- `TransactionType.INQUIRY` (Status check)
- `TransactionType.REFUND` (Refund)
- `TransactionType.REVERSE` (Reversal)
- `TransactionType.CANCEL` (Cancellation)

Transactions are persisted via `TransactionRepository`.

---

## 19. Persistence Integration

For production, use `@company/payment-persistence-postgres` or implement the core repository interfaces (`PaymentRepository`, `TransactionRepository`, `IdempotencyRepository`, `WebhookEventRepository`).

### Example with PostgreSQL Repositories:

```ts
import { Pool } from 'pg';
import {
  PostgresPaymentRepository,
  PostgresTransactionRepository,
  PostgresIdempotencyRepository,
  PostgresWebhookEventRepository,
  DatabaseMigrator,
} from '@company/payment-persistence-postgres';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Run migrations
const migrator = new DatabaseMigrator(pool);
await migrator.up();

// Instantiate repositories
const paymentRepository = new PostgresPaymentRepository(pool);
const transactionRepository = new PostgresTransactionRepository(pool);
const idempotencyRepository = new PostgresIdempotencyRepository(pool);
const webhookEventRepository = new PostgresWebhookEventRepository(pool);
```

---

## 20. Sandbox Mode

Gateways support sandbox environments for development and staging:

- **Zibal**: Set `merchant: 'zibal'` and `environment: 'sandbox'`.
- **Zarinpal**: Set `environment: 'sandbox'`. Uses sandbox endpoint `https://sandbox.zarinpal.com`.
- **Mellat / Saman**: Set `environment: 'sandbox'`.
- **MockGateway**: `@company/payment-service/testing` provides `MockGateway` for zero-network testing.

---

## 21. Production Checklist

- [ ] All passwords, terminal IDs, and merchant keys are stored in secure environment variables.
- [ ] `PAYMENT_ENV` is explicitly set to `production`.
- [ ] Database persistence (`PostgresPaymentRepository`, etc.) is configured.
- [ ] Database migrations (`DatabaseMigrator`) have been run.
- [ ] Callback and Webhook endpoints are hosted behind HTTPS.
- [ ] Payment verification is explicitly called on every success callback.
- [ ] Sensitive fields (passwords, card numbers) are redacted in log outputs.

---

## 22. REST API Integration

Your main application exposes HTTP routes using its web framework (Express, Fastify, NestJS).

Recommended REST API structure:

- `POST /api/v1/payments` — Create payment
- `GET /api/v1/payments/:id` — Get payment status
- `POST /api/v1/payments/callback/:gateway` — Callback entry point
- `POST /api/v1/payments/:id/verify` — Verify payment
- `POST /api/v1/payments/:id/inquiry` — Inquire remote payment status
- `POST /api/v1/payments/:id/refund` — Refund payment

---

## 23. OpenAPI Integration

Installing payment packages does **not** automatically modify your application's `openapi.yml`. OpenAPI specs represent your application's public HTTP API contract, whereas payment packages are TypeScript libraries.

When adding or modifying payment endpoints in your application, update your application's `openapi.yml` accordingly.

---

## 24. Logging & Observability

`PaymentApplicationService` accepts a `PaymentLogger` implementation:

```ts
const customLogger = {
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta),
  info: (msg, meta) => console.info(`[INFO] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
};

const paymentService = new PaymentApplicationService({
  registry,
  paymentRepository,
  transactionRepository,
  logger: customLogger,
});
```

---

## 25. Testing Strategy

Use `InMemoryPaymentRepository`, `InMemoryTransactionRepository`, and `MockGateway` from `@company/payment-service/testing` for unit and integration testing without network calls:

```ts
import { createTestPaymentService, MockGateway } from '@company/payment-service/testing';

const mockGateway = new MockGateway({ id: 'test-gateway', scenario: 'success' });
const { service } = createTestPaymentService({ gateways: [mockGateway] });

const result = await service.createPayment({
  gateway: 'test-gateway',
  amount: 1000,
  currency: 'IRR',
});
```

---

## 26. Troubleshooting

| Symptom                       | Cause                                                         | Solution                                                                   |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `GatewayNotFoundError`        | Gateway not registered in `GatewayRegistry`                   | Call `registry.register(gateway)` during application bootstrap.            |
| `UnsupportedCapabilityError`  | Attempting capability not offered by PSP                      | Check `provider-capabilities.md` or `gateway.supportsCapability()`.        |
| `InvalidPaymentStateError`    | Illegal state transition (e.g. verifying non-pending payment) | Check payment status before triggering action.                             |
| Callback verification failure | Callback parameters mismatched or altered                     | Verify query/body parameters passed to `handleCallback` / `verifyPayment`. |

---

## 27. Security Guidelines

1. **HTTPS Enforcement**: Always host callback and webhook endpoints over HTTPS.
2. **Callback Validation**: Always verify payments with the PSP after callback processing.
3. **No Secret Leaks**: Never log raw card data, user passwords, or merchant secret keys.

---

## 28. Common Developer Mistakes

1. **Assuming Callback == Payment Success**: PSP callbacks can be spoofed. Always execute `verifyPayment`.
2. **Missing Gateway Registration**: Forgetting to register gateway instances in `GatewayRegistry` on startup.
3. **Modifying Core for Provider Quirks**: Provider-specific features should be placed in `options` or provider packages, keeping Core clean.

---

## 29. Upgrade Strategy

When upgrading package versions:

1. Update `package.json` version dependencies for `@company/payment-core` and providers together.
2. Run database migrations using `DatabaseMigrator` if `@company/payment-persistence-postgres` was updated.
3. Execute unit tests (`pnpm test`).

---

## 30. Complete Integration Example

```ts
import { GatewayRegistry } from '@company/payment-core';
import { PaymentApplicationService } from '@company/payment-service';
import {
  InMemoryPaymentRepository,
  InMemoryTransactionRepository,
} from '@company/payment-service/testing';
import { ZibalGateway } from '@company/payment-zibal';

async function run() {
  // 1. Initialize registry and register provider
  const registry = new GatewayRegistry();
  const zibalGateway = new ZibalGateway({
    merchant: 'zibal',
    callbackUrl: 'https://example.com/callback/zibal',
    environment: 'sandbox',
  });
  registry.register(zibalGateway);

  // 2. Initialize repositories and service
  const paymentRepo = new InMemoryPaymentRepository();
  const transactionRepo = new InMemoryTransactionRepository();

  const service = new PaymentApplicationService({
    registry,
    paymentRepository: paymentRepo,
    transactionRepository: transactionRepo,
  });

  // 3. Create payment
  const created = await service.createPayment({
    gateway: 'zibal',
    amount: 100000,
    currency: 'IRR',
  });

  console.log('Payment created with ID:', created.payment.id);
  console.log('Redirect URL:', created.redirectUrl);
}

run().catch(console.error);
```
