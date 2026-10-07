# AI Integration Guide & Authoritative Contract

> **Authoritative Contract for AI Coding Agents**
> This document is the single source of truth and integration contract for any AI Coding Agent integrating the Payment Package Ecosystem into target consumer applications.
> While this document serves as the authoritative integration guide, the actual source code and public TypeScript package exports remain the ultimate ground truth for implementation behavior and API signatures.

---

## 1. What This Payment Ecosystem Is

This Payment Package Ecosystem is a modular, provider-agnostic payment orchestrator and gateway integration library built for Node.js and TypeScript applications.

Key characteristics:

- **Provider Agnostic:** Provides uniform domain interfaces (`Payment`, `Transaction`, `PaymentGateway`, `GatewayRegistry`) so consumer applications interact with standard contracts regardless of the underlying Iranian Payment Service Provider (PSP) or gateway.
- **Capability-Driven:** Payment operations are gated by explicit capability interfaces (`CanCreatePayment`, `CanVerify`, `CanInquire`, `CanRefund`, `CanReverse`, `CanAuthorize`, `CanCapture`, `CanCancel`, `CanHandleCallback`, `CanHandleWebhook`).
- **Library, Not Application:** The ecosystem consists of headless library packages. It does **not** expose public HTTP servers, REST controllers, or persistent databases on its own; those responsibilities belong to the consumer target application.
- **Opt-In Persistence:** Core persistence contracts are database-agnostic. A production PostgreSQL implementation is provided in `@company/payment-persistence-postgres`, while memory-backed repositories exist in `@company/payment-service/testing`.

---

## 2. Source of Truth & Verification Hierarchy

When integrating or resolving questions about package behavior, follow this strict hierarchy:

1. **Actual Source Code** (`packages/*/src/...`)
2. **Public TypeScript Package Exports** (`src/index.ts` and `package.json` `exports`)
3. **Automated Unit & Integration Test Suites** (`packages/*/tests/...`)
4. **Package Metadata** (`package.json`)
5. **Existing Reference Examples** (`examples/...`)
6. **Provider Specifications & Documentation** (`Mellat.md`, `ziball.json`, `zarinpall.md`, `Saman.json`)
7. **Existing Human Documentation** (`docs/...`)

_Rule:_ Existing human documentation cannot authorize or validate an API signature or feature claim that actual source code or public exports do not confirm.

---

## 3. Package Architecture

The monorepo architecture strictly isolates concerns across layer boundaries:

```text
Target Application (REST Controllers / DTOs / Business Rules / Database)
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

### Persistence Architecture

```text
Target Application
        │
        ▼
PaymentApplicationService
        │
        ▼
@company/payment-core contracts (PaymentRepository, TransactionRepository, etc.)
        │
        ▼
Persistence Adapter (@company/payment-persistence-postgres OR InMemory Repositories)
        │
        ▼
Database / Storage
```

### Layer Responsibilities

- **`@company/payment-core`**: Defines domain entities (`Payment`, `Transaction`, `IdempotencyRecord`, `WebhookEvent`), contracts (`PaymentGateway`, capabilities), errors (`PaymentPlatformError` hierarchy), and the `GatewayRegistry`. Zero external payment dependencies.
- **Provider Packages** (`@company/payment-mellat`, `@company/payment-zibal`, `@company/payment-zarinpal`, `@company/payment-saman`): Implement provider client, request/response mappers, error mappers, callback parsers, and capabilities. Depend **only** on `@company/payment-core`. Provider packages NEVER depend on each other.
- **`@company/payment-service`**: Application orchestration service (`PaymentApplicationService` / `PaymentService`), idempotency protection (`IdempotencyOrchestrator`), retry & timeout policies, and testing utilities (`MockGateway`, `TestGateway`, `InMemory*` repositories). Depends on `@company/payment-core`.
- **`@company/payment-persistence-postgres`**: PostgreSQL implementations of `PaymentRepository`, `TransactionRepository`, `IdempotencyRepository`, and `WebhookEventRepository`, along with schema migrations (`DatabaseMigrator`). Depends on `@company/payment-core` and `pg`.
- **Target Application**: Implements HTTP controllers, REST routes, DTOs, request validation, authentication, authorization, business rules, OpenAPI specs, and wiring.

---

## 4. Dependency Rules

- **No Circular Dependencies:** Core has no provider dependencies. Providers depend only on Core.
- **No Gateway Dependencies Between Providers:** `@company/payment-mellat` never imports from `@company/payment-zibal`, etc.
- **Public Imports Only:** Target applications must import from top-level package exports (e.g., `import { GatewayRegistry } from '@company/payment-core'`). Subpath imports are allowed **only** where explicitly exported in `package.json` (such as `import { MockGateway } from '@company/payment-service/testing'`). Never import internal source paths like `@company/payment-mellat/src/...`.

---

## 5. Package Selection

Target applications should install only the packages required for their specific implementation:

| Package Name                            |   Required   | Purpose / Responsibility                                                                         | Dependencies                  |
| :-------------------------------------- | :----------: | :----------------------------------------------------------------------------------------------- | :---------------------------- |
| `@company/payment-core`                 | **Required** | Core domain entities, capability contracts, error hierarchy, and GatewayRegistry.                | None                          |
| `@company/payment-service`              |   Optional   | Higher-level application orchestration service, retry policies, idempotency, and test utilities. | `@company/payment-core`       |
| `@company/payment-mellat`               |   Optional   | Mellat (Behpardazht) PSP gateway implementation.                                                 | `@company/payment-core`       |
| `@company/payment-zibal`                |   Optional   | Zibal IPG gateway implementation.                                                                | `@company/payment-core`       |
| `@company/payment-zarinpal`             |   Optional   | Zarinpal GraphQL v4 gateway implementation.                                                      | `@company/payment-core`       |
| `@company/payment-saman`                |   Optional   | Saman (SEP) gateway implementation.                                                              | `@company/payment-core`       |
| `@company/payment-persistence-postgres` |   Optional   | PostgreSQL persistence repositories and SQL migrations.                                          | `@company/payment-core`, `pg` |

---

## 6. Installation & Package Registries

Target applications consume packages published to GitHub Packages. The GitHub source repository is the single source of truth, while packages are distributed exclusively through **GitHub Packages**.

### Consumer `.npmrc` Configuration

Consumer projects configure `.npmrc` to authenticate with GitHub Packages:

```ini
@company:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Installation Commands

Install required scoped packages via your package manager (e.g., `pnpm` or `npm`):

```bash
# Core orchestrator and selected provider packages
pnpm add @company/payment-core @company/payment-service @company/payment-mellat @company/payment-zibal

# Optional: Add PostgreSQL persistence adapter if using PostgreSQL
pnpm add @company/payment-persistence-postgres pg
```

_Note: If a provider package is not installed and registered, it is not available at runtime. Do not install unneeded provider packages._

---

## 7. Runtime & TypeScript Requirements

- **Node.js:** `>=18.0.0`
- **TypeScript:** `>=5.0.0` (Target `ES2022` or later, `moduleResolution: "nodenext"` or `"node16"`)
- **Peer Dependencies:**
  - `pg` (`^8.11.5`) if using `@company/payment-persistence-postgres`.

---

## 8. Configuration

Each provider package exports a typed configuration interface and validation function (`validateMellatConfig`, `validateZibalConfig`, `validateZarinpalConfig`, `validateSamanConfig`).

### Mellat Configuration (`MellatConfig`)

```ts
export interface MellatConfig extends GatewayConfig {
  readonly environment?: PaymentEnvironment; // 'production' | 'sandbox' | 'test'
  readonly terminalId: string | number;
  readonly userName: string;
  readonly userPassword: string;
  readonly callbackUrl: string;
  readonly requestTimeoutMs?: number;
  readonly portalUrl?: string; // Required if environment is sandbox or isSandbox is true
  readonly wsdlUrl?: string; // Required if environment is sandbox or isSandbox is true
  readonly subServiceId?: string | number;
}
```

### Zibal Configuration (`ZibalConfig`)

```ts
export interface ZibalConfig extends GatewayConfig {
  merchant: string; // Set to 'zibal' for test mode in sandbox
  callbackUrl: string;
  environment?: PaymentEnvironment;
  baseUrl?: string;
  gatewayId?: string; // Defaults to 'zibal'
}
```

_Validation Note:_ `validateZibalConfig` throws a `ConfigurationError` if `environment === 'production'` and `merchant === 'zibal'`.

### Zarinpal Configuration (`ZarinpalConfig`)

```ts
export interface ZarinpalConfig extends GatewayConfig {
  accessToken: string;
  callbackUrl: string;
  environment?: PaymentEnvironment;
  merchantId?: string;
  baseUrl?: string; // Required if environment is sandbox or isSandbox is true
  startPayUrl?: string;
  gatewayId?: string; // Defaults to 'zarinpal'
}
```

### Saman Configuration (`SamanConfig`)

```ts
export interface SamanConfig extends GatewayConfig {
  terminalId: string;
  redirectUrl: string;
  environment?: PaymentEnvironment;
  tokenUrl?: string; // Required if environment is sandbox or isSandbox is true
  verifyUrl?: string; // Required if environment is sandbox or isSandbox is true
  reverseUrl?: string;
  paymentFormUrl?: string;
  gatewayId?: string; // Defaults to 'saman'
}
```

---

## 9. Environment Variables

Store credentials securely in environment variables.

| Environment Variable    |  Required / Optional  | Consumer Package                        | Purpose                                              | Secret? | Validation Rule                                     |
| :---------------------- | :-------------------: | :-------------------------------------- | :--------------------------------------------------- | :-----: | :-------------------------------------------------- |
| `PAYMENT_ENV`           |       Optional        | `@company/payment-core`                 | Global environment (`production`, `sandbox`, `test`) |   No    | Must be `'production'`, `'sandbox'`, or `'test'`    |
| `MELLAT_TERMINAL_ID`    |  Required for Mellat  | `@company/payment-mellat`               | Numeric or string terminal ID                        |   No    | Non-empty                                           |
| `MELLAT_USERNAME`       |  Required for Mellat  | `@company/payment-mellat`               | Gateway username                                     |   Yes   | Non-empty string                                    |
| `MELLAT_PASSWORD`       |  Required for Mellat  | `@company/payment-mellat`               | Gateway password                                     |   Yes   | Non-empty string                                    |
| `MELLAT_CALLBACK_URL`   |  Required for Mellat  | `@company/payment-mellat`               | Application callback URL                             |   No    | Non-empty URL string                                |
| `ZIBAL_MERCHANT`        |  Required for Zibal   | `@company/payment-zibal`                | Merchant ID (`zibal` for sandbox)                    |   Yes   | Non-empty string; cannot be `'zibal'` in production |
| `ZIBAL_CALLBACK_URL`    |  Required for Zibal   | `@company/payment-zibal`                | Application callback URL                             |   No    | Non-empty URL string                                |
| `ZARINPAL_ACCESS_TOKEN` | Required for Zarinpal | `@company/payment-zarinpal`             | Personal Access Token                                |   Yes   | Non-empty string                                    |
| `ZARINPAL_MERCHANT_ID`  | Optional for Zarinpal | `@company/payment-zarinpal`             | Merchant UUID                                        |   No    | String                                              |
| `ZARINPAL_CALLBACK_URL` | Required for Zarinpal | `@company/payment-zarinpal`             | Application callback URL                             |   No    | Non-empty URL string                                |
| `SAMAN_TERMINAL_ID`     |  Required for Saman   | `@company/payment-saman`                | Terminal ID                                          |   No    | Non-empty string                                    |
| `SAMAN_CALLBACK_URL`    |  Required for Saman   | `@company/payment-saman`                | Application redirect/callback URL                    |   No    | Non-empty URL string                                |
| `DATABASE_URL`          | Required if Postgres  | `@company/payment-persistence-postgres` | PostgreSQL connection string                         |   Yes   | Valid Postgres URL                                  |

---

## 10. Provider Registration

Providers are instantiated and explicitly registered into an instance of `GatewayRegistry`.

```ts
import { GatewayRegistry, PaymentEnvironment } from '@company/payment-core';
import { MellatGateway } from '@company/payment-mellat';
import { ZibalGateway } from '@company/payment-zibal';

export function configureGatewayRegistry(): GatewayRegistry {
  const registry = new GatewayRegistry();
  const env = (process.env.PAYMENT_ENV as PaymentEnvironment) || 'production';

  const mellat = new MellatGateway({
    gatewayId: 'mellat',
    terminalId: Number(process.env.MELLAT_TERMINAL_ID),
    userName: process.env.MELLAT_USERNAME!,
    userPassword: process.env.MELLAT_PASSWORD!,
    callbackUrl: process.env.MELLAT_CALLBACK_URL!,
    environment: env,
  });
  registry.register(mellat);

  const zibal = new ZibalGateway({
    gatewayId: 'zibal',
    merchant: process.env.ZIBAL_MERCHANT!,
    callbackUrl: process.env.ZIBAL_CALLBACK_URL!,
    environment: env,
  });
  registry.register(zibal);

  return registry;
}
```

### Registry Behavior

- `register(gateway)`: Registers gateway. Throws `ConfigurationError` if gateway ID is already registered.
- `getGateway(id)`: Returns gateway or throws `GatewayNotFoundError`.
- `getActiveGateway(id, capability?)`: Returns enabled gateway or throws `GatewayNotFoundError`, `GatewayDisabledError`, or `UnsupportedCapabilityError`.

---

## 11. Payment Creation

Payment creation initiates a session with the PSP gateway and generates redirect or POST form parameters.

### Execution Flow

```text
Target Application Endpoint
        │
        ▼
PaymentApplicationService.createPayment({ gateway, amount, currency, description })
        │
        ▼
GatewayRegistry.getActiveGateway(gateway, CREATE_PAYMENT)
        │
        ▼
Gateway.createPayment({ payment, options })
        │
        ▼
Returns CreatePaymentOutput { payment, transaction, status, redirectUrl, actionUrl, action, reference, gatewayTransactionId }
```

### Code Example

```ts
import { PaymentApplicationService } from '@company/payment-service';

const result = await paymentAppService.createPayment({
  gateway: 'zibal',
  amount: 500000, // Amount in IRR (Rials)
  currency: 'IRR',
  description: 'Order #1002 Payment',
  idempotencyKey: 'checkout_order_1002',
});

console.log(result.payment.id); // Internal UUID (e.g. 'pay_...')
console.log(result.status); // PaymentStatus (e.g. 'PENDING')
console.log(result.redirectUrl); // Optional HTTP GET redirect URL
console.log(result.actionUrl); // Optional HTTP POST action URL
console.log(result.action); // Form parameters object for POST form
console.log(result.gatewayTransactionId); // Gateway authority / track ID / RefNum
```

---

## 12. Redirect Flow

Gateway responses instruct how the customer must be redirected to the PSP payment form:

1. **GET Redirect (`redirectUrl`):** When `redirectUrl` is returned (e.g., Zibal or Zarinpal), perform an HTTP `302 Found` redirect to `redirectUrl`.
2. **POST Form Action (`actionUrl` & `action`):** When `actionUrl` and `action` form fields are returned (e.g., Mellat RefId form or Saman Token form), render an auto-submitting HTML POST form or return the parameters to the frontend application to submit via POST.

---

## 13. Callback Flow

When the customer completes or cancels payment at the PSP, the PSP posts or redirects back to the target application's callback URL.

> **CRITICAL RULE:** Receiving a callback does **NOT** mean payment success. A callback ONLY returns authority to the application. Payment verification MUST be executed immediately.

```ts
// Inside target application callback handler
const callbackResult = await paymentAppService.handleCallback('mellat', {
  query: req.query as Record<string, unknown>,
  body: req.body as Record<string, unknown>,
  headers: req.headers as Record<string, string | string[] | undefined>,
});

if (callbackResult.isSuccess && (callbackResult.paymentId || callbackResult.gatewayTransactionId)) {
  const verifyResult = await paymentAppService.verifyPayment({
    paymentId: callbackResult.paymentId,
    gatewayTransactionId: callbackResult.gatewayTransactionId,
    reference: callbackResult.reference,
    callbackData: callbackResult.rawData,
  });

  if (verifyResult.status === 'SUCCESS') {
    // Fulfill order
  }
}
```

---

## 14. Verification

Verification invokes the PSP gateway API to validate that funds were successfully transferred.

```ts
const verifyResult = await paymentAppService.verifyPayment({
  paymentId: 'pay_123456789',
  gatewayTransactionId: '12345678', // PSP RefNum / TrackId
});

if (verifyResult.status === 'SUCCESS') {
  // Order marked as paid
}
```

- **Supported by:** `@company/payment-mellat`, `@company/payment-zibal`, `@company/payment-zarinpal`, `@company/payment-saman`.
- **Behavior on Repeated Verification:** `PaymentApplicationService.verifyPayment` short-circuits and returns existing success details if payment status is already `SUCCESS`.

---

## 15. Inquiry

Inquiry checks the payment status directly from the PSP gateway without performing state transitions.

```ts
const inquiryResult = await paymentAppService.inquirePayment('pay_123456789');
console.log(inquiryResult.status);
```

- **Supported by:** `@company/payment-mellat`, `@company/payment-zibal`.
- **Not Supported by:** `@company/payment-zarinpal`, `@company/payment-saman` (calling inquiry on these throws `UnsupportedCapabilityError`).

---

## 16. Refund

Refund returns funds for a previously verified payment back to the customer's account.

```ts
const refundResult = await paymentAppService.refundPayment({
  paymentId: 'pay_123456789',
  amount: 100000,
  reason: 'Customer requested refund',
});
```

- **Supported by:** `@company/payment-mellat`.
- **Not Supported by:** `@company/payment-zibal`, `@company/payment-zarinpal`, `@company/payment-saman` (throws `UnsupportedCapabilityError`).

---

## 17. Reverse / Cancel

Reverse cancels an authorization or transaction before settlement (typically same-day reversal).

```ts
const reverseResult = await paymentAppService.reversePayment({
  paymentId: 'pay_123456789',
  reason: 'Order fulfillment failure',
});
```

- **Supported by:** `@company/payment-mellat`, `@company/payment-saman`.
- **Not Supported by:** `@company/payment-zibal`, `@company/payment-zarinpal` (throws `UnsupportedCapabilityError`).

---

## 18. Webhook

Webhooks handle asynchronous server-to-server notifications sent by gateways.

- **Current Gateway Support Status:** `— NOT SUPPORTED BY CURRENT PROVIDERS`
- Interfaces and data structures (`CanHandleWebhook`, `WebhookEvent`, `WebhookEventRepository`, `handleWebhook`) exist in Core and Service, but no current PSP provider sends webhooks.

---

## 19. Idempotency — Deep Verification

`PaymentApplicationService` uses `IdempotencyOrchestrator` to protect sensitive financial operations (`createPayment`, `verifyPayment`, `authorizePayment`, `capturePayment`, `refundPayment`, `cancelPayment`, `reversePayment`).

- **Scope & Key Format:** Scope is formatted as `<method>:<gateway_or_paymentId>` (e.g., `create_payment:zibal`, `verify_payment:pay_123`).
- **Storage & Scope:**
  - **With `IdempotencyRepository`:** Database-backed persistence. SHA-256 hash of payload is validated. Same key + matching payload returning completed status returns cached result without invoking PSP gateway again. If payload differs, throws `PersistenceConflictError`. If request is pending, throws `ConcurrencyError`.
  - **Without `IdempotencyRepository`:** Memory-only execution pass-through within `PaymentApplicationService`.

---

## 20. Persistence — Deep Verification

Applications must persist payment entities across HTTP requests.

### Core Domain Entities & Interfaces

- **`Payment`:** `id`, `projectId`, `amount`, `currency`, `description`, `callbackUrl`, `gateway`, `status` (`CREATED`, `PENDING`, `AUTHORIZED`, `SUCCESS`, `FAILED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED`, `REVERSED`, `CALLBACK_RECEIVED`), `metadata`, `idempotencyKey`, `version`, `createdAt`, `updatedAt`. Supports optimistic concurrency via `version`.
- **`Transaction`:** `id`, `paymentId`, `gateway`, `type` (`PAYMENT`, `AUTHORIZATION`, `CAPTURE`, `CANCEL`, `VERIFY`, `REFUND`, `REVERSE`, `INQUIRY`), `status` (`SUCCESS`, `FAILED`, `PENDING`), `amount`, `reference`, `gatewayTransactionId`, `metadata`, `createdAt`, `updatedAt`.
- **`IdempotencyRecord`:** Stores idempotency key, scope, request hash, status (`PENDING`, `COMPLETED`, `FAILED`), result, and expiration.
- **`WebhookEvent`:** Stores provider, eventId, eventType, status (`RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED`), payload, attempts, and error.

### Repositories

- **PostgreSQL (`@company/payment-persistence-postgres`):** `PostgresPaymentRepository`, `PostgresTransactionRepository`, `PostgresIdempotencyRepository`, `PostgresWebhookEventRepository`.
- **In-Memory (`@company/payment-service/testing`):** `InMemoryPaymentRepository`, `InMemoryTransactionRepository`, `InMemoryIdempotencyRepository`, `InMemoryWebhookEventRepository`.

---

## 21. Error Handling

All ecosystem errors inherit from `PaymentPlatformError`.

### Error Hierarchy

- `PaymentPlatformError` (Base class, statusCode defaults to 500)
  - `ValidationError` (HTTP 400) - Invalid inputs or missing mandatory config fields.
  - `GatewayError` (HTTP 502) - Gateway network failure or raw error response.
  - `GatewayNotFoundError` (HTTP 404) - Gateway ID not registered in `GatewayRegistry`.
  - `GatewayDisabledError` (HTTP 422) - Gateway `isEnabled` is false.
  - `UnsupportedCapabilityError` (HTTP 422) - Requested capability not supported by gateway.
  - `PaymentError` (HTTP 400) - Payment domain error.
    - `InvalidPaymentStateError` / `InvalidStateTransitionError` (HTTP 400) - Invalid status transition.
  - `TransactionError` (HTTP 400) - Invalid transaction operation.
  - `ConfigurationError` (HTTP 500) - Misconfigured gateway or missing setup.
  - `PersistenceError` (HTTP 500) - Database operation error.
    - `PersistenceConflictError` (HTTP 409) - Idempotency payload mismatch or conflict.
    - `RepositoryNotFoundError` (HTTP 404) - Entity missing in database.
    - `ConcurrencyError` (HTTP 409) - Optimistic concurrency lock failure (`version` mismatch).
    - `PersistenceUnavailableError` (HTTP 503) - Database connection unavailable.

### Provider Error Mappers

Each provider package exports a public error mapper that translates raw provider codes into normalized `GatewayError` or `PaymentError`:

- `MellatErrorMapper` (`@company/payment-mellat`)
- `ZibalErrorMapper` (`@company/payment-zibal`)
- `ZarinpalErrorMapper` (`@company/payment-zarinpal`)
- `SamanErrorMapper` (`@company/payment-saman`)

---

## 22. REST API Integration

> **CRITICAL RULE:** Payment packages are headless libraries and do NOT automatically create the consumer application's REST API endpoints.

Target applications are fully responsible for HTTP controllers, routes, request validation, authentication, authorization, error handling, and DTO definitions.

### Reference Endpoint Pattern

- `POST /api/v1/payments` - Create payment session
- `POST /api/v1/payments/callback/:gateway` or `GET /api/v1/payments/callback/:gateway` - Receive browser redirect from PSP
- `POST /api/v1/payments/:id/verify` - Trigger payment verification
- `GET /api/v1/payments/:id` - Query local payment status

---

## 23. OpenAPI Integration

> **CRITICAL RULE:** Installing payment packages does NOT automatically modify or update the target application's OpenAPI specification.

When AI agents add or alter REST payment endpoints in a target project, they **MUST** update the application's `openapi.yml` or OpenAPI specification file accordingly.

- Internal credentials (`userName`, `userPassword`, `accessToken`, `terminalId`) MUST NEVER be exposed in public OpenAPI endpoints or schemas.

---

## 24. Sandbox & Test Mode

| Provider Package            | Real PSP Sandbox | Test Mode / Merchant | Verified Source & Requirement                                                                                                                |
| :-------------------------- | :--------------: | :------------------: | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `@company/payment-mellat`   |        —         |          —           | No public PSP sandbox URL documented in specification. Setting `environment: 'sandbox'` requires providing custom `wsdlUrl` and `portalUrl`. |
| `@company/payment-zibal`    |        ✓         |   `zibal` merchant   | Supported. Set `merchant: 'zibal'` in sandbox/test mode. Blocked from production by `validateZibalConfig`.                                   |
| `@company/payment-zarinpal` |        —         |          —           | No public PSP sandbox GraphQL endpoint in v4 spec. Setting `environment: 'sandbox'` requires providing custom `baseUrl`.                     |
| `@company/payment-saman`    |        —         |          —           | No public PSP sandbox URL in spec. Setting `environment: 'sandbox'` requires providing custom `tokenUrl` and `verifyUrl`.                    |
| `MockGateway`               |       N/A        |      Local Mock      | Local in-memory mock gateway from `@company/payment-service/testing` for unit/integration tests.                                             |

---

## 25. Production Safety

1. `PAYMENT_ENV` must be set to `'production'`.
2. Zibal merchant `'zibal'` is strictly forbidden in production mode (`validateZibalConfig` throws error).
3. Production credentials (`userPassword`, `accessToken`, `DATABASE_URL`) MUST be loaded from environment variables or key vaults. Never hardcode credentials.
4. Callback URLs must use secure HTTPS endpoints.
5. Production financial transactions must NEVER be run in automated CI pipelines.

---

## 26. Testing

### 1. Unit Testing with `MockGateway`

Target applications should use `MockGateway` from `@company/payment-service/testing`:

```ts
import { GatewayRegistry } from '@company/payment-core';
import { MockGateway } from '@company/payment-service/testing';

const registry = new GatewayRegistry();
registry.register(new MockGateway({ id: 'zibal', scenario: 'success' }));
```

### Supported Scenarios on `MockGateway`

- `'success'` - Normal successful creation and verification
- `'declined'` - Payment declined by bank
- `'timeout'` - Gateway timeout
- `'network-error'` - Communication failure
- `'provider-error'` - Gateway error response
- `'invalid-state'` - Invalid transition error
- `'customer-action-required'` - Customer action pending
- `'pending'` - Payment left in pending status

---

## 27. Multiple Providers

Registering multiple providers at runtime is natively supported via `GatewayRegistry`.

```ts
const registry = new GatewayRegistry();
registry.register(mellatGateway);
registry.register(zibalGateway);
registry.register(zarinpalGateway);
registry.register(samanGateway);

// Resolve gateway dynamically at runtime
const gateway = registry.getActiveGateway(userSelectedGatewayId);
```

_Note on Fallback / Load Balancing:_ `GatewayRegistry` handles gateway lookup and capability checking. Automated gateway routing, load balancing, or automatic fallback retries across different providers are NOT built into the library and must be implemented at the application layer if required.

---

## 28. Provider Capability Matrix

Capabilities verified directly from source code implementation:

| Provider Package            | `CREATE_PAYMENT` | `VERIFY` | `INQUIRY` | `REFUND` | `REVERSE` | `CALLBACK` | `WEBHOOK` | `AUTHORIZE` | `CAPTURE` | `CANCEL` |
| :-------------------------- | :--------------: | :------: | :-------: | :------: | :-------: | :--------: | :-------: | :---------: | :-------: | :------: |
| `@company/payment-mellat`   |        ✓         |    ✓     |     ✓     |    ✓     |     ✓     |     ✓      |     —     |      —      |     —     |    —     |
| `@company/payment-zibal`    |        ✓         |    ✓     |     ✓     |    —     |     —     |     ✓      |     —     |      —      |     —     |    —     |
| `@company/payment-zarinpal` |        ✓         |    ✓     |     —     |    —     |     —     |     ✓      |     —     |      —      |     —     |    —     |
| `@company/payment-saman`    |        ✓         |    ✓     |     —     |    —     |     ✓     |     ✓      |     —     |      —      |     —     |    —     |
| `MockGateway` (Testing)     |        ✓         |    ✓     |     ✓     |    ✓     |     ✓     |     ✓      |     ✓     |      ✓      |     ✓     |    ✓     |

_Legend: `✓` Verified Supported | `—` Verified Not Supported_

---

## 29. Common AI Failure Modes

1. **Inventing Provider APIs:** Attempting to call non-existent methods like `zarinpalGateway.refund()` or `samanGateway.inquire()`.
2. **Inventing Sandbox Endpoints:** Assuming official public sandbox URLs exist for Mellat, Zarinpal, or Saman without providing required custom URLs.
3. **Assuming Callback Equals Success:** Treating browser return as payment confirmation without executing `verifyPayment`.
4. **Importing Internal Paths:** Using `import { MellatGateway } from '@company/payment-mellat/src/gateway/mellat-gateway'`.
5. **Ignoring Capability Checks:** Calling `refundPayment` or `reversePayment` without verifying gateway capability.
6. **Hardcoding Credentials:** Embedding terminal IDs, passwords, or tokens in source code or committed files.
7. **Bypassing OpenAPI Updates:** Creating or modifying REST controllers without updating the target project's `openapi.yml`.
8. **Bypassing Type Safety:** Using `as any` to bypass configuration or domain entity type checks.

---

## 30. AI Agent Decision Rules

AI agents must follow this sequential decision process when integrating payment features:

```text
Need Payment Integration?
        │
        ▼
Inspect Target Project Architecture & Framework
        │
        ▼
Identify Required Provider(s)
        │
Is Provider Package Installed?
    ├── No ──► Install required package only
    └── Yes
        │
        ▼
Inspect Public Package Exports
        │
        ▼
Check Provider Capability Matrix
        │
        ▼
Configure Environment Variables (.env.example)
        │
        ▼
Initialize GatewayRegistry & Register Gateways
        │
        ▼
Setup Persistence & PaymentApplicationService
        │
        ▼
Implement REST Endpoints (Create, Callback, Verify)
        │
        ▼
Update OpenAPI Specification
        │
        ▼
Add Deterministic Unit Tests using MockGateway
        │
        ▼
Execute Validation (Typecheck, Lint, Tests)
```

---

## 31. AI Agent Rules

1. **Rule 1 — Never Invent APIs:** Use only classes, interfaces, and methods verified in public package exports.
2. **Rule 2 — Inspect Before Coding:** Always inspect target application files and exports before making changes.
3. **Rule 3 — Respect Layer Isolation:** Do not add provider-specific logic into `@company/payment-core`.
4. **Rule 4 — Verify Capability:** Check provider capability before invoking `inquiry`, `refund`, or `reverse`.
5. **Rule 5 — Use Public Exports:** Import only from top-level package entrypoints (`@company/payment-core`).
6. **Rule 6 — Preserve Target Architecture:** Match the target project's existing coding standards and framework patterns.
7. **Rule 7 — Callback Is Not Automatically Success:** Always execute `verifyPayment` after receiving a callback.
8. **Rule 8 — Never Expose Secrets:** Keep credentials in environment variables; never commit secrets or leak them in OpenAPI specs.
9. **Rule 9 — Synchronize OpenAPI:** Update `openapi.yml` whenever REST endpoints are added or changed.
10. **Rule 10 — Practice Proactive Validation:** Run typecheck, lint, and tests before completing work.

---

## 32. Deterministic AI Integration Workflow

```text
1. Inspect target project structure and dependencies
2. Identify required payment gateways
3. Install required package dependencies
4. Configure environment variables in .env.example
5. Initialize GatewayRegistry and register provider gateways
6. Configure persistence repositories and PaymentApplicationService
7. Implement REST controller endpoints (Create, Callback, Verify)
8. Update target application OpenAPI specification
9. Add deterministic unit tests using MockGateway
10. Run workspace build, typecheck, lint, and test suites
11. Perform final validation
```

---

## 33. Integration Checklist

- [ ] Target application inspected and framework identified.
- [ ] Required payment provider packages identified.
- [ ] Only necessary packages installed.
- [ ] Public exports verified.
- [ ] Environment variables configured (`.env.example` updated).
- [ ] `GatewayRegistry` initialized and gateways registered.
- [ ] Payment service / persistence layer initialized.
- [ ] Payment creation endpoint implemented.
- [ ] Redirect handling (GET redirect / POST form) implemented.
- [ ] Callback endpoint implemented.
- [ ] Payment verification implemented immediately after callback.
- [ ] Idempotency keys passed for payment creation and verification.
- [ ] Errors handled using `PaymentPlatformError` hierarchy.
- [ ] Target application REST controller and routes updated.
- [ ] Target application `openapi.yml` updated.
- [ ] Unit tests created using `MockGateway`.
- [ ] Typecheck passed.
- [ ] Lint passed.
- [ ] Tests passed.

---

## 34. Documentation Verification & Audit Report Summary

| Audit Aspect                 | Verified Status | Notes                                                                                                                                                                                   |
| :--------------------------- | :-------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Packages Audited**         |   `VERIFIED`    | All 7 workspace packages audited (`core`, `service`, `persistence-postgres`, `mellat`, `zibal`, `zarinpal`, `saman`).                                                                   |
| **Public Exports**           |   `VERIFIED`    | Top-level package exports verified from `src/index.ts`.                                                                                                                                 |
| **Capabilities Matrix**      |   `VERIFIED`    | Mellat (Create, Verify, Inquiry, Refund, Reverse, Callback), Zibal (Create, Verify, Inquiry, Callback), Zarinpal (Create, Verify, Callback), Saman (Create, Verify, Reverse, Callback). |
| **Configuration Interfaces** |   `VERIFIED`    | `MellatConfig`, `ZibalConfig`, `ZarinpalConfig`, `SamanConfig` and their validation functions audited.                                                                                  |
| **Environment Variables**    |   `VERIFIED`    | Variable names, requirement rules, and consumer packages matched.                                                                                                                       |
| **Idempotency Model**        |   `VERIFIED`    | Scope formatting, SHA-256 payload hashing, pending concurrency handling, and cached result retrieval verified in `IdempotencyOrchestrator`.                                             |
| **Persistence Repositories** |   `VERIFIED`    | `Payment`, `Transaction`, `IdempotencyRecord`, `WebhookEvent` entities, postgres repositories, and optimistic concurrency (`version`) verified.                                         |
| **Sandbox Claims**           |   `VERIFIED`    | Real PSP sandbox constraints (Zibal test merchant vs Mellat/Zarinpal/Saman custom endpoint requirements) verified.                                                                      |
| **Production Safety**        |   `VERIFIED`    | Zibal merchant guard, HTTPS requirements, and credential separation verified.                                                                                                           |
| **Code Examples**            |   `VERIFIED`    | All documentation code examples verified via TypeScript compiler (`tsc --noEmit`).                                                                                                      |

---

## 35. Final Validation Status

All claims and examples in this document have been audited against actual source code implementations and verified using TypeScript typechecking and automated test suites.

```text
PHASE 8 COMPLETE
```
