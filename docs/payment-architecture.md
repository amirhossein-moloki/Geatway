# Payment Architecture Specification

## Overview

The payment ecosystem is designed around strict separation between core orchestrator logic, payment provider packages, application integration layer, and the consuming application.

```text
┌─────────────────────────────────────────────────────────┐
│                   Consumer Application                  │
│       (REST / GraphQL API, Controllers, Routes)          │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
     Payment Commands / Inputs     OpenAPI Contract (openapi.yml)
                │                         │
┌───────────────▼─────────────────────────▼───────────────┐
│             Application Integration Layer               │
│              (@company/payment-service)                 │
│  - PaymentApplicationService                            │
│  - IdempotencyOrchestrator                              │
│  - Retry & Timeout Policies                             │
│  - Webhook / Callback Handler                           │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
┌───────────────▼───────────────┐ ┌───────▼──────────────┐
│     @company/payment-core     │ │ Persistence Layer    │
│  - Domain Entities            │ │ @company/payment-    │
│  - Gateway Registry & Contracts│ │  persistence-postgres│
│  - Normalized Errors          │ │ (or Custom Repos)    │
└───────────────┬───────────────┘ └──────────────────────┘
                │
  ┌─────────────┼───────────────┬──────────────┐
  ▼             ▼               ▼              ▼
payment-mellat payment-zibal payment-zarinpal payment-saman
```

## Architectural Boundaries

### 1. `@company/payment-core`

- Defines core payment entities (`Payment`, `Transaction`, `IdempotencyRecord`, `WebhookEvent`).
- Defines capability-based contracts (`CanCreatePayment`, `CanVerify`, `CanInquire`, `CanRefund`, `CanReverse`, `CanCancel`, `CanHandleCallback`, `CanHandleWebhook`).
- Manages `GatewayRegistry` for registering active gateways.
- Standardizes normalized errors (`ValidationError`, `GatewayNotFoundError`, `GatewayDisabledError`, `UnsupportedCapabilityError`, `InvalidPaymentStateError`, `GatewayError`).
- Contains **zero** provider-specific details or direct network dependencies.

### 2. Provider Packages (`@company/payment-mellat`, `@company/payment-zibal`, `@company/payment-zarinpal`, `@company/payment-saman`)

- Implement `PaymentGateway` and specific capability interfaces.
- Perform network communication with provider endpoints.
- Map domain requests to provider DTOs and provider responses back to domain responses.

### 3. Application Integration Layer (`@company/payment-service`)

- `PaymentApplicationService` coordinates gateways, persistence repositories, idempotency checking, and error mapping.
- Enforces retries (`RetryPolicy`) and timeouts (`TimeoutPolicy`).
- Manages webhook deduplication and out-of-order execution rules.

### 4. Consumer Application

- Owns HTTP framework integration (Express, Fastify, NestJS, etc.).
- Exposes REST API endpoints and updates its public `openapi.yml` specification.
- Registers gateways into `GatewayRegistry` upon application startup.
