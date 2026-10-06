# Payment Platform Testing Architecture & Strategy

This document outlines the testing strategy, environment configuration, local mock gateway, and provider sandbox integration for the Payment Platform Monorepo.

---

## 1. Testing Strategy Overview

The platform enforces a strict separation between four operational modes:

```text
Local / Development
    = Application execution environment

Unit Testing
    = Automated deterministic test execution without external network access

Sandbox Testing
    = Integration testing against provider non-production environments or test modes

Production
    = Real live payment processing
```

---

## 2. Three-Layer Testing Model

### Layer 1 — Unit Tests (Deterministic)

- **Execution**: `pnpm test` or `pnpm test:unit`
- **Network Access**: Forbidden.
- **Components**: Uses `MockGateway`, `InMemoryPaymentRepository`, `InMemoryTransactionRepository`, and mocked HTTP transports.
- **Runs In**: CI/CD on every pull request.

### Layer 2 — Provider Sandbox Integration Tests

- **Execution**: `pnpm test:sandbox` (or `RUN_SANDBOX_TESTS=true pnpm test`)
- **Network Access**: Provider sandbox endpoints / test modes only.
- **Safety Requirement**: Fails fast if `PAYMENT_ENV=production`.
- **Runs In**: Opt-in developer environments and credential-configured CI pipelines.

### Layer 3 — Production Integration

- **Execution**: Live production execution.
- **Automated Testing Policy**: Automated tests MUST NOT execute financial transactions against production endpoints. Production tests are limited to startup configuration validation and connectivity checks.

---

## 3. Environment Configuration

The application environment is selected using `PAYMENT_ENV`:

```env
PAYMENT_ENV=sandbox
# or
PAYMENT_ENV=production
```

### Environment File Template (`.env.sandbox.example`)

To run sandbox tests, copy `.env.sandbox.example` to `.env` or set environment variables:

```env
PAYMENT_ENV=sandbox
RUN_SANDBOX_TESTS=true

# Zibal Test Mode Configuration
ZIBAL_SANDBOX_MERCHANT=zibal
ZIBAL_SANDBOX_CALLBACK_URL=https://example.com/callback

# Mellat Sandbox Configuration
MELLAT_SANDBOX_TERMINAL_ID=123456
MELLAT_SANDBOX_USERNAME=testuser
MELLAT_SANDBOX_PASSWORD=testpass
MELLAT_SANDBOX_CALLBACK_URL=https://example.com/callback
# MELLAT_SANDBOX_WSDL_URL=https://test-server.example.com/pgw?wsdl
# MELLAT_SANDBOX_PORTAL_URL=https://test-server.example.com/startpay
```

---

## 4. Local Deterministic Mock Gateway

For unit testing and local application service development, use `MockGateway` (or `TestGateway` from `@company/payment-service/testing`).

### Explicit Registration

`MockGateway` is NEVER automatically registered in production. It must be registered explicitly:

```ts
import { GatewayRegistry } from '@company/payment-core';
import { MockGateway } from '@company/payment-service/testing';

const registry = new GatewayRegistry();
const mockGateway = new MockGateway('test-gateway');
registry.register(mockGateway);
```

### Failure & Scenario Simulation

`MockGateway` supports deterministic scenarios:

```ts
mockGateway.scenario = 'success'; // Succeeded operations
mockGateway.scenario = 'declined'; // Card declined by issuer
mockGateway.scenario = 'timeout'; // Request timeout
mockGateway.scenario = 'network-error'; // Network / connection error
mockGateway.scenario = 'provider-error'; // Internal provider error
mockGateway.scenario = 'invalid-state'; // Invalid state transition
mockGateway.scenario = 'customer-action-required'; // Requires redirect/customer action
mockGateway.scenario = 'pending'; // Pending verify/inquiry response
```

---

## 5. Generic Payment Testing Flow

### Step-by-step generic flow:

1. **Initialize Payment Service**: Register gateway and repositories.
2. **Create Payment**: Call `service.createPayment()`, receive `redirectUrl` and `gatewayTransactionId`.
3. **Persist Payment**: Payment stored in status `PENDING`.
4. **Simulate Customer Callback**:
   Call `service.handleCallback(gatewayId, { query, body, headers })`.
5. **Verify Payment**: Call `service.verifyPayment({ paymentId, reference })`. Status becomes `SUCCESS`.
6. **Inquiry Payment**: Call `service.inquirePayment(paymentId)`.
7. **Refund Payment**: Call `service.refundPayment({ paymentId, amount })`. Status becomes `PARTIALLY_REFUNDED` or `REFUNDED`.

---

## 6. Provider Sandbox Matrix & Capabilities

| Provider | Sandbox Available | Sandbox Endpoint             | Sandbox Credentials | Supported Flows                              | Notes                                                                                 |
| -------- | ----------------- | ---------------------------- | ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Mellat   | PARTIAL           | NOT DOCUMENTED in v1.29 spec | REQUIRED_FROM_PSP   | Unit Mock Tests                              | Official spec v1.29 does not document current sandbox URL; requires custom `wsdlUrl`. |
| Zibal    | YES               | `https://gateway.zibal.ir`   | `merchant: "zibal"` | Request, Redirect, Verify, Inquiry, Callback | Uses production endpoint with test merchant string `"zibal"`.                         |
| Zarinpal | UNKNOWN           | NOT DOCUMENTED in v4 spec    | REQUIRED_FROM_PSP   | Unit Mock Tests                              | v4 GraphQL specification does not document public sandbox endpoint.                   |
| Saman    | UNKNOWN           | NOT DOCUMENTED in Postman    | REQUIRED_FROM_PSP   | Unit Mock Tests                              | Postman collection does not document public sandbox endpoint.                         |
| Stripe   | NOT IMPLEMENTED   | N/A                          | N/A                 | N/A                                          | Provider package not present in repo.                                                 |
| PayPal   | NOT IMPLEMENTED   | N/A                          | N/A                 | N/A                                          | Provider package not present in repo.                                                 |
| Adyen    | NOT IMPLEMENTED   | N/A                          | N/A                 | N/A                                          | Provider package not present in repo.                                                 |

---

## 7. Safety Guard & Troubleshooting

### Safety Guards

- **Production Guard**: When `RUN_SANDBOX_TESTS=true` and `PAYMENT_ENV=production`, tests abort immediately with `Safety Guard Error`.
- **Credential Validation**: Attempting to use `merchant: "zibal"` when `PAYMENT_ENV=production` throws `ConfigurationError`.
- **Missing Custom Sandbox URLs**: Attempting to initialize Mellat, Saman, or Zarinpal in `environment: "sandbox"` without supplying required custom sandbox URLs throws `ConfigurationError`.

### Troubleshooting Checklist

- `ConfigurationError`: Verify required fields in provider config.
- `Safety Guard Error`: Ensure `PAYMENT_ENV` is set to `sandbox` or `test` when running sandbox integration tests.
- `Network Error`: Provider sandbox endpoints may be unreachable; ensure internet connectivity or use `MockGateway`.
