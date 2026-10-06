# AI Integration Guide & Authoritative Contract

> **Authoritative Contract for AI Coding Agents**
> This document is the single source of truth for any AI Coding Agent integrating the Payment Package Ecosystem into a target consumer application.
> Read this document completely before generating code, installing packages, or modifying target project configurations.

---

## 1. What This Payment Ecosystem Is

This Payment Package Ecosystem is a modular, provider-agnostic payment orchestrator and gateway integration library built for Node.js and TypeScript applications.

Key characteristics:
* **Provider Agnostic:** Provides uniform domain interfaces (`Payment`, `Transaction`, `PaymentGateway`, `GatewayRegistry`) so consumer applications interact with standard contracts regardless of the underlying Iranian Payment Service Provider (PSP) or gateway.
* **Capability-Driven:** Payment operations are gated by explicit capability interfaces (`CanCreatePayment`, `CanVerify`, `CanInquire`, `CanRefund`, `CanReverse`, `CanHandleCallback`, `CanHandleWebhook`).
* **Library, Not Application:** The ecosystem consists of headless library packages. It does **not** expose public HTTP servers, REST controllers, or persistent databases on its own; those responsibilities belong to the consumer target application.
* **Opt-In Persistence:** Core persistence contracts are database-agnostic. A production PostgreSQL implementation is provided in `@company/payment-persistence-postgres`, while memory-backed repositories exist in `@company/payment-service/testing`.

---

## 2. Package Architecture

The monorepo architecture strictly isolates concerns across layer boundaries:

```text
Target Application (REST Controllers / Business Domain / Database)
        │
        ▼
@company/payment-service (Application Orchestration / Retry / Idempotency / Test Utilities)
        │
        ▼
@company/payment-core (Domain Entities / Gateway Contracts / Registry / Standard Errors)
        ▲                             ▲                            ▲                           ▲
        │                             │                            │                           │
@company/payment-mellat     @company/payment-zibal      @company/payment-zarinpal   @company/payment-saman
```

### Dependency Rules
* **`@company/payment-core`** has zero external payment dependencies and defines all contracts, errors, and capabilities.
* **Provider Packages** (`@company/payment-mellat`, `@company/payment-zibal`, `@company/payment-zarinpal`, `@company/payment-saman`) depend **only** on `@company/payment-core`. Provider packages NEVER depend on each other.
* **`@company/payment-service`** depends on `@company/payment-core` and orchestrates lifecycle workflows, retries, and idempotency.
* **`@company/payment-persistence-postgres`** depends on `@company/payment-core` and `pg`.
* **Target Applications** install only `@company/payment-core`, `@company/payment-service` (optional but recommended for orchestration), and the specific provider packages required.

---

## 3. Package Selection

Select only the packages needed by the target application:

| Package Name | Purpose / Responsibility |
| :--- | :--- |
| `@company/payment-core` | **Required.** Core domain entities, contracts, error hierarchy, and GatewayRegistry. |
| `@company/payment-service` | **Recommended.** Higher-level application orchestration service, idempotency handling, and test utilities. |
| `@company/payment-mellat` | Mellat (Behpardazht) PSP gateway implementation. |
| `@company/payment-zibal` | Zibal IPG gateway implementation. |
| `@company/payment-zarinpal` | Zarinpal GraphQL v4 gateway implementation. |
| `@company/payment-saman` | Saman (SEP) gateway implementation. |
| `@company/payment-persistence-postgres` | PostgreSQL persistence repositories for payments, transactions, idempotency, and webhooks. |

---

## 4. Installation

Install only the packages required for your project via your package manager:

```bash
# Example: Monorepo with Mellat and Zibal
pnpm add @company/payment-core @company/payment-service @company/payment-mellat @company/payment-zibal

# Optional: Add PostgreSQL persistence if using Postgres
pnpm add @company/payment-persistence-postgres pg
```

*Note: Do not install unneeded provider packages.*

---

## 5. Required Dependencies

* **Runtime Node.js:** `>=18.0.0`
* **TypeScript:** `>=5.0.0` (target `ES2022` or later, `moduleResolution: "nodenext"` or `"node16"`)
* **Peer Dependencies:**
  * `pg` (`^8.11.0`) if using `@company/payment-persistence-postgres`.

---

## 6. Configuration

Each provider package exports a dedicated configuration interface and validation function.

### Mellat Configuration (`MellatConfig`)
```ts
export interface MellatConfig extends GatewayConfig {
  terminalId: number;
  userName: string;
  userPassword: string;
  callbackUrl: string;
  environment?: 'production' | 'sandbox' | 'test';
  wsdlUrl?: string; // Required if environment is sandbox
  portalUrl?: string; // Required if environment is sandbox
  gatewayId?: string; // Defaults to 'mellat'
}
```

### Zibal Configuration (`ZibalConfig`)
```ts
export interface ZibalConfig extends GatewayConfig {
  merchant: string; // Set to 'zibal' for test mode in sandbox
  callbackUrl: string;
  environment?: 'production' | 'sandbox' | 'test';
  baseUrl?: string;
  gatewayId?: string; // Defaults to 'zibal'
}
```

### Zarinpal Configuration (`ZarinpalConfig`)
```ts
export interface ZarinpalConfig extends GatewayConfig {
  accessToken: string;
  callbackUrl: string;
  merchantId?: string;
  environment?: 'production' | 'sandbox' | 'test';
  baseUrl?: string; // Required if environment is sandbox
  startPayUrl?: string;
  gatewayId?: string; // Defaults to 'zarinpal'
}
```

### Saman Configuration (`SamanConfig`)
```ts
export interface SamanConfig extends GatewayConfig {
  terminalId: string;
  redirectUrl: string;
  environment?: 'production' | 'sandbox' | 'test';
  tokenUrl?: string; // Required if environment is sandbox
  verifyUrl?: string; // Required if environment is sandbox
  reverseUrl?: string;
  paymentFormUrl?: string;
  gatewayId?: string; // Defaults to 'saman'
}
```

---

## 7. Environment Variables

Store gateway credentials securely in environment variables.

| Environment Variable | Required/Optional | Purpose | Package | Secret? |
| :--- | :--- | :--- | :--- | :--- |
| `PAYMENT_ENV` | Optional | Global environment (`production`, `sandbox`, `test`) | All | No |
| `MELLAT_TERMINAL_ID` | Required for Mellat | Numeric terminal ID | `@company/payment-mellat` | No |
| `MELLAT_USERNAME` | Required for Mellat | Gateway username | `@company/payment-mellat` | Yes |
| `MELLAT_PASSWORD` | Required for Mellat | Gateway password | `@company/payment-mellat` | Yes |
| `MELLAT_CALLBACK_URL` | Required for Mellat | Application callback URL | `@company/payment-mellat` | No |
| `ZIBAL_MERCHANT` | Required for Zibal | Merchant string (`zibal` for sandbox) | `@company/payment-zibal` | Yes |
| `ZIBAL_CALLBACK_URL` | Required for Zibal | Application callback URL | `@company/payment-zibal` | No |
| `ZARINPAL_ACCESS_TOKEN` | Required for Zarinpal | Personal Access Token / Secret | `@company/payment-zarinpal` | Yes |
| `ZARINPAL_MERCHANT_ID` | Optional for Zarinpal | Merchant UUID | `@company/payment-zarinpal` | No |
| `ZARINPAL_CALLBACK_URL` | Required for Zarinpal | Application callback URL | `@company/payment-zarinpal` | No |
| `SAMAN_TERMINAL_ID` | Required for Saman | Terminal ID string | `@company/payment-saman` | No |
| `SAMAN_CALLBACK_URL` | Required for Saman | Application callback URL | `@company/payment-saman` | No |
| `DATABASE_URL` | Required if Postgres | Postgres connection string | `@company/payment-persistence-postgres` | Yes |

---

## 8. Provider Registration

Providers are instantiated and explicitly registered into an instance of `GatewayRegistry` from `@company/payment-core`.

```ts
import { GatewayRegistry } from '@company/payment-core';
import { MellatGateway } from '@company/payment-mellat';
import { ZibalGateway } from '@company/payment-zibal';

export function configureGatewayRegistry(): GatewayRegistry {
  const registry = new GatewayRegistry();

  const mellat = new MellatGateway({
    gatewayId: 'mellat',
    terminalId: Number(process.env.MELLAT_TERMINAL_ID),
    userName: process.env.MELLAT_USERNAME!,
    userPassword: process.env.MELLAT_PASSWORD!,
    callbackUrl: process.env.MELLAT_CALLBACK_URL!,
    environment: (process.env.PAYMENT_ENV as any) || 'production',
  });
  registry.register(mellat);

  const zibal = new ZibalGateway({
    gatewayId: 'zibal',
    merchant: process.env.ZIBAL_MERCHANT!,
    callbackUrl: process.env.ZIBAL_CALLBACK_URL!,
    environment: (process.env.PAYMENT_ENV as any) || 'production',
  });
  registry.register(zibal);

  return registry;
}
```

---

## 9. Payment Creation

Payment creation initiates a session with the chosen gateway and generates redirect parameters.

### Execution Flow
```text
Target Application REST Endpoint
        │
        ▼
PaymentApplicationService.createPayment({ gateway, amount, currency, description })
        │
        ▼
GatewayRegistry.getGateway(gateway)
        │
        ▼
MellatGateway / ZibalGateway / ZarinpalGateway / SamanGateway .createPayment(...)
        │
        ▼
Returns CreatePaymentResult { payment, redirectUrl, actionUrl, action, gatewayTransactionId }
```

### Code Example
```ts
import { PaymentApplicationService } from '@company/payment-service';

const result = await paymentAppService.createPayment({
  gateway: 'zibal',
  amount: 500000, // Amount in IRR / Rials
  currency: 'IRR',
  description: 'Order #1002 Payment',
  idempotencyKey: 'checkout_order_1002',
});

console.log(result.payment.id);             // Internal UUID
console.log(result.redirectUrl);            // Optional HTTP GET redirect URL
console.log(result.actionUrl);              // Optional HTTP POST action URL
console.log(result.action);                 // POST form parameters if applicable
console.log(result.gatewayTransactionId);   // Trackable gateway authority / ref
```

---

## 10. Redirect Flow

Gateway responses instruct how the customer must be redirected to the PSP payment form:

1. **GET Redirect (`redirectUrl`):** When `redirectUrl` is provided (e.g., Zibal or Zarinpal), send an HTTP `302 Found` redirect to the URL.
2. **POST Form Action (`actionUrl` & `action`):** When `actionUrl` and `action` parameters are provided (e.g., Mellat RefId form or Saman Token form), render an HTML auto-submitting POST form or send form fields to the frontend to POST directly.

---

## 11. Callback Flow

When the user completes or cancels payment at the PSP, the PSP posts or redirects back to the application's callback endpoint.

> **CRITICAL RULE:** Receiving a callback does **NOT** mean payment success. A callback ONLY transfers authority back to the application. Verification MUST be executed.

```ts
// Inside target application HTTP callback handler
const callbackResult = await paymentAppService.handleCallback('mellat', {
  query: req.query,
  body: req.body,
  headers: req.headers,
});

if (callbackResult.isSuccess && callbackResult.paymentId) {
  // Proceed immediately to verification
  const verifyResult = await paymentAppService.verifyPayment({
    paymentId: callbackResult.paymentId,
    gatewayTransactionId: callbackResult.gatewayTransactionId,
    reference: callbackResult.reference,
    callbackData: callbackResult.rawData,
  });

  if (verifyResult.status === 'VERIFIED' || verifyResult.status === 'PAID') {
    // Payment verified successfully
  }
}
```

---

## 12. Verification

Verification calls the PSP gateway API to validate that funds were successfully charged.

```ts
const verifyResult = await paymentAppService.verifyPayment({
  paymentId: 'payment_uuid',
  gatewayTransactionId: '12345678', // Authority / TrackId / RefNum
});

if (verifyResult.status === 'VERIFIED' || verifyResult.status === 'PAID') {
  // Update order status to paid
}
```

* Supported by: **Mellat**, **Zibal**, **Zarinpal**, **Saman**.

---

## 13. Inquiry

Inquiry checks the current status of a payment directly from the PSP without performing verification transitions.

```ts
const inquiryResult = await paymentAppService.inquirePayment({
  paymentId: 'payment_uuid',
  gatewayTransactionId: '12345678',
});
```

* Supported by: **Mellat**, **Zibal**.
* Status for Zarinpal: `NOT SUPPORTED BY THIS PROVIDER`
* Status for Saman: `NOT SUPPORTED BY THIS PROVIDER`

---

## 14. Refund

Refund returns funds for a previously verified payment back to the customer's card/account.

```ts
const refundResult = await paymentAppService.refundPayment({
  paymentId: 'payment_uuid',
  amount: 100000,
  currency: 'IRR',
  reason: 'Customer requested cancellation',
});
```

* Supported by: **Mellat**.
* Status for Zibal: `NOT SUPPORTED BY THIS PROVIDER`
* Status for Zarinpal: `NOT SUPPORTED BY THIS PROVIDER`
* Status for Saman: `NOT SUPPORTED BY THIS PROVIDER`

---

## 15. Reverse / Cancel

Reverse cancels a transaction before settlement (typically same-day reversal).

```ts
const reverseResult = await paymentAppService.reversePayment({
  paymentId: 'payment_uuid',
  reason: 'Order processing failed prior to fulfillment',
});
```

* Supported by: **Mellat**, **Saman**.
* Status for Zibal: `NOT SUPPORTED BY THIS PROVIDER`
* Status for Zarinpal: `NOT SUPPORTED BY THIS PROVIDER`

---

## 16. Webhook

Webhooks handle asynchronous server-to-server notifications sent by gateways.

* Status across all current providers: `NOT IMPLEMENTED / NOT SUPPORTED BY CURRENT PROVIDERS`
* Contracts exist in `@company/payment-core` (`CanHandleWebhook`, `WebhookEvent`), but no provider currently sends webhooks.

---

## 17. Idempotency

`PaymentApplicationService` provides built-in idempotency protection for sensitive operations (creation, verification, refund, reversal).

Pass an `idempotencyKey` in requests:
```ts
await paymentAppService.createPayment({
  gateway: 'zibal',
  amount: 100000,
  currency: 'IRR',
  idempotencyKey: 'unique_checkout_session_id',
});
```

If the same key is supplied within the idempotency window, the cached result is returned without calling the provider gateway again.

---

## 18. Persistence

Applications must persist domain entities across payment lifecycle steps.

Entities:
* `Payment`: Contains `id`, `amount`, `currency`, `status`, `gatewayId`, `gatewayTransactionId`, `version`.
* `Transaction`: Contains `id`, `paymentId`, `type` (`AUTHORIZATION`, `CAPTURE`, `VERIFICATION`, `REFUND`, `REVERSE`, `CANCEL`), `amount`, `status`, `rawRequest`, `rawResponse`.
* `IdempotencyRecord`: Stores idempotency key hashes, responses, and execution state.
* `WebhookEvent`: Stores incoming webhook logs.

Use `@company/payment-persistence-postgres` for PostgreSQL, or implement the interfaces from `@company/payment-core` (`PaymentRepository`, `TransactionRepository`, `IdempotencyRepository`, `WebhookEventRepository`).

---

## 19. Error Handling

All ecosystem errors inherit from `PaymentPlatformError`.

### Core Error Hierarchy
* `PaymentPlatformError` (base class)
  * `ValidationError` (HTTP 400) - Invalid parameters or missing config.
  * `GatewayError` (HTTP 502) - Provider returned error response or network failure.
  * `GatewayNotFoundError` (HTTP 404) - Gateway ID not registered in registry.
  * `GatewayDisabledError` (HTTP 422) - Gateway is disabled.
  * `UnsupportedCapabilityError` (HTTP 422) - Gateway does not support requested capability.
  * `PaymentError` (HTTP 400) - General payment domain error.
    * `InvalidPaymentStateError` / `InvalidStateTransitionError` (HTTP 400) - Invalid state machine transition.
  * `TransactionError` (HTTP 400) - Invalid transaction operation.
  * `ConfigurationError` (HTTP 500) - Gateway or system configuration error.
  * `PersistenceError` (HTTP 500) - Database error.
    * `PersistenceConflictError` (HTTP 409)
    * `RepositoryNotFoundError` (HTTP 404)
    * `ConcurrencyError` (HTTP 409) - Optimistic concurrency failure.
    * `PersistenceUnavailableError` (HTTP 503)

### Provider Error Mapping
Each provider package implements an error mapper (`MellatErrorMapper`, `ZibalErrorMapper`, `ZarinpalErrorMapper`, `SamanErrorMapper`) that translates raw PSP codes into normalized `GatewayError` or `PaymentError` instances.

---

## 20. REST API Integration

> **CRITICAL RULE:** Payment packages are headless libraries, NOT the target application REST API.

The target application is responsible for implementing HTTP controllers, routing, DTO validation, authentication, and HTTP response formatting.

### Reference Controller Architecture
```ts
import { AppController } from '../controllers/payment.controller';

// POST /api/v1/payments
app.post('/api/v1/payments', async (req, res) => {
  const result = await controller.handleCreatePayment(req.body);
  res.status(result.statusCode).json(result.body);
});

// POST /api/v1/payments/callback/:gateway
app.post('/api/v1/payments/callback/:gateway', async (req, res) => {
  const result = await controller.handleCallback(req.params.gateway, req);
  if (result.redirectUrl) {
    return res.redirect(302, result.redirectUrl);
  }
  res.status(result.statusCode).json(result.body);
});
```

---

## 21. OpenAPI Integration

> **CRITICAL RULE:** Installing payment packages does NOT automatically update `openapi.yml` in the consumer application.

When adding or modifying payment REST endpoints in the target application, you **MUST** update the application's `openapi.yml` or OpenAPI specification file.

* Document endpoints: `POST /api/v1/payments`, `GET /api/v1/payments/{id}`, `POST /api/v1/payments/callback/{gateway}`, `POST /api/v1/payments/{id}/verify`.
* Do NOT leak internal credentials or raw provider parameters (e.g. `terminalId`, `userName`, `userPassword`) into public OpenAPI schemas.

---

## 22. Sandbox

Sandboxing allows testing payment flows without real bank transactions.

| Gateway | Sandbox Behavior | Configuration Requirements |
| :--- | :--- | :--- |
| **Mellat** | Simulated test environment | Set `environment: 'sandbox'`. Requires custom `wsdlUrl` and `portalUrl`. |
| **Zibal** | Test merchant mode | Set `environment: 'sandbox'` and `merchant: 'zibal'`. |
| **Zarinpal** | Custom endpoint required | Set `environment: 'sandbox'`. Requires custom `baseUrl`. |
| **Saman** | Custom endpoint required | Set `environment: 'sandbox'`. Requires custom `tokenUrl` and `verifyUrl`. |
| **MockGateway** | In-memory simulated gateway | Use `MockGateway` from `@company/payment-service/testing` for unit/integration tests. |

---

## 23. Production

Production safety checks:
1. `PAYMENT_ENV` must be set to `production`.
2. Zibal merchant `'zibal'` is explicitly blocked in production mode by `validateZibalConfig`.
3. All secrets (`userPassword`, `accessToken`, `DATABASE_URL`) MUST be loaded from environment variables or key vaults.
4. Ensure callback URLs use HTTPS endpoints.

---

## 24. Testing

### Unit Testing with MockGateway
Use `MockGateway` from `@company/payment-service/testing` in target application tests:

```ts
import { GatewayRegistry } from '@company/payment-core';
import { MockGateway } from '@company/payment-service/testing';

const registry = new GatewayRegistry();
registry.register(new MockGateway({ id: 'zibal', scenario: 'success' }));
```

### Supported Scenarios on `MockGateway`
* `'success'` - Normal successful creation & verification
* `'declined'` - Payment declined by bank
* `'timeout'` - Network timeout scenario
* `'network-error'` - Communication failure
* `'provider-error'` - Gateway error code response
* `'invalid-state'` - Invalid transition
* `'customer-action-required'` - Pending user action
* `'pending'` - Transaction pending verification

---

## 25. Multiple Providers

The ecosystem natively supports registering and switching between multiple providers at runtime via `GatewayRegistry`.

```ts
const registry = new GatewayRegistry();
registry.register(mellatGateway);
registry.register(zibalGateway);
registry.register(zarinpalGateway);
registry.register(samanGateway);

// Select gateway dynamically per order
const gateway = registry.getGateway(userSelectedGatewayId);
```

---

## 26. Provider Capability Matrix

Capabilities verified directly from source code implementation:

| Provider Package | `CREATE_PAYMENT` | `VERIFY` | `INQUIRY` | `REFUND` | `REVERSE` | `CALLBACK` | `WEBHOOK` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `@company/payment-mellat` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `@company/payment-zibal` | ✓ | ✓ | ✓ | — | — | ✓ | — |
| `@company/payment-zarinpal` | ✓ | ✓ | — | — | — | ✓ | — |
| `@company/payment-saman` | ✓ | ✓ | — | — | ✓ | ✓ | — |

*Legend: `✓` Supported | `—` NOT SUPPORTED BY THIS PROVIDER*

---

## 27. Common Mistakes

1. **Installing all provider packages:** Only install the provider packages your application requires.
2. **Importing from internal paths:** Never import from `@company/payment-mellat/src/...`. Use public package entrypoints (`@company/payment-mellat`).
3. **Assuming callback = success:** Always trigger `verifyPayment` upon receiving a callback.
4. **Hardcoding secrets:** Never hardcode passwords, terminal IDs, or access tokens in source code.
5. **Calling unsupported capabilities:** Check the Provider Capability Matrix before attempting refund, inquiry, or reverse.
6. **Forgetting to update OpenAPI:** Always update the target application's `openapi.yml` when REST routes change.
7. **Bypassing idempotency:** Pass `idempotencyKey` on financial creation and verification operations.

---

## 28. Rules for AI Coding Agents

1. **Rule 1 — Never Invent APIs:** Only use classes, interfaces, and methods verified in public package exports.
2. **Rule 2 — Inspect Before Coding:** Always inspect target application files, installed packages, and exports before making changes.
3. **Rule 3 — Respect Package Boundaries:** Do not add provider-specific logic into `@company/payment-core`.
4. **Rule 4 — Check Capabilities:** Verify provider capability before calling `inquiry`, `refund`, or `reverse`.
5. **Rule 5 — Use Public Exports:** Use top-level exports (`import { ... } from '@company/payment-core'`).
6. **Rule 6 — Preserve Target Architecture:** Adapt your integration code to match the framework and patterns of the target project.
7. **Rule 7 — Update OpenAPI:** Update `openapi.yml` whenever adding or changing REST endpoints.
8. **Rule 8 — Never Expose Secrets:** Ensure credentials remain in `.env` files and environment variables.
9. **Rule 9 — Callback Is Not Automatically Success:** Always verify payments after receiving callbacks.
10. **Rule 10 — Validate Before Completion:** Run build, typecheck, lint, and unit tests before declaring work complete.

---

## 29. Integration Checklist

- [ ] Target application inspected and target framework identified.
- [ ] Required payment provider packages identified.
- [ ] Only necessary packages installed.
- [ ] Public exports verified.
- [ ] Environment variables configured (`.env.example` updated).
- [ ] `GatewayRegistry` initialized and gateways registered.
- [ ] Payment service / persistence layer initialized.
- [ ] Payment creation endpoint implemented.
- [ ] Redirect handling (GET/POST form) implemented.
- [ ] Callback endpoint implemented.
- [ ] Payment verification implemented immediately after callback.
- [ ] Idempotency keys used for payment creation/verification.
- [ ] Errors handled using `PaymentPlatformError` hierarchy.
- [ ] Target application REST controller and routes updated.
- [ ] Target application `openapi.yml` updated.
- [ ] Unit tests created using `MockGateway`.
- [ ] Build and test commands executed successfully.

---

## 30. Deterministic AI Integration Workflow

```text
1. Inspect Target Project Framework & Structure
2. Identify Required Payment Gateways
3. Install Package Dependencies (@company/payment-core, provider packages, persistence)
4. Configure Environment Variables
5. Initialize GatewayRegistry & Register Gateways
6. Setup Persistence Repositories & PaymentApplicationService
7. Implement REST Controllers (Create, Callback, Verify)
8. Update Target Application OpenAPI Specification
9. Add Unit Tests using MockGateway
10. Run Typecheck, Lint, and Test Suites
11. Perform Final Validation
```
