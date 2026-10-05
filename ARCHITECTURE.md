# Architecture Documentation — Payment Core Platform (Phase 1)

## 1. Executive Summary & Core Responsibilities

The **Payment Platform Core** is a provider-agnostic payment orchestration foundation built with Node.js and TypeScript (Strict Mode). Its primary purpose is to decouple payment domain logic and business rules from provider-specific APIs (such as Zarinpal, Mellat, Stripe, PayPal, etc.).

### Core Responsibilities:

- Standardizing payment entities, transaction records, and lifecycle status transitions.
- Providing capability-based interfaces (`GatewayContract`) for polymorphic gateway integration.
- Managing gateway registration, status checks, and runtime capability checks via `GatewayRegistry`.
- Standardizing platform error reporting with domain-specific HTTP status codes and error structures.
- Providing idempotency hooks and configuration abstractions for future persistence and infrastructure layers.

---

## 2. Decoupling & Gateway Capability Design

### Why Core Must Be Provider-Agnostic

Different payment providers have vastly different features, protocol semantics, callback models, and transaction capabilities:

- Iranian IPGs (Zarinpal, Mellat) rely on redirect-based web checkout with verification/inquiry steps.
- International Gateways (Stripe, Adyen) rely on tokenization, webhooks, intent mechanisms, and direct refunds/reversals.
- Certain gateways do NOT support refunds, reverses, or tokenization.

To prevent bloating the Core domain or creating monolithic interfaces with unsupported dummy methods, the core employs **Capability-based Segregation**.

### Gateway Capabilities Architecture

Gateways declare supported capabilities using `GatewayCapability` flags:

- `CREATE_PAYMENT`
- `VERIFY`
- `INQUIRY`
- `REFUND`
- `REVERSE`
- `WEBHOOK`
- `TOKENIZATION`
- `RECURRING`

Individual capability interfaces (`CanCreatePayment`, `CanVerify`, `CanRefund`, etc.) ensure adapters only implement methods for capabilities they actually support. `PaymentService` and `GatewayRegistry` validate capabilities at runtime prior to execution.

---

## 3. Payment Lifecycle & State Machine

Payment statuses transition strictly according to the defined state machine:

```text
               ┌──────────┐
               │ CREATED  │
               └────┬─────┘
                    │
                    ▼
               ┌──────────┐
               │ PENDING  │
               └────┬─────┘
        ┌───────────┼───────────┐
        ▼           ▼           ▼
  ┌───────────┐ ┌──────────┐ ┌─────────┐
  │ REDIRECTED│ │ CALLBACK │ │ FAILED  │
  └─────┬─────┘ │ RECEIVED │ └─────────┘
        │       └────┬─────┘
        └────────────┼──────────┐
                     ▼          ▼
                ┌─────────┐ ┌─────────┐
                │ SUCCESS │ │ CANCEL  │
                └────┬────┘ └─────────┘
          ┌──────────┴──────────┐
          ▼                     ▼
    ┌──────────┐          ┌──────────┐
    │ REFUNDED │          │ REVERSED │
    └──────────┘          └──────────┘
```

### Transition Enforcement:

- Unlawful status jumps (e.g., `CREATED` -> `SUCCESS` or `FAILED` -> `SUCCESS`) throw an `InvalidStateTransitionError`.
- Terminal statuses (`SUCCESS`, `FAILED`, `CANCELLED`, `REFUNDED`, `REVERSED`) restrict invalid state mutations.

---

## 4. Extension Strategy for Future Phases

### Gateway Adapters (Phase 2 / Phase 3)

When implementing a new Provider (e.g., Zarinpal):

1. Create a class implementing `PaymentGateway` and specific capability interfaces (e.g., `CanCreatePayment`, `CanVerify`).
2. Adapt provider request/response formats into platform standard DTOs (`CreatePaymentRequest`, `VerifyPaymentResponse`, etc.).
3. Register the adapter into `GatewayRegistry`.

### REST API Layer & SDKs

- **REST API**: Exposes HTTP endpoints mapping requests to `PaymentService` methods and translates `PaymentPlatformError` instances to structured HTTP JSON error responses.
- **SDKs**: Wrap HTTP API clients using standard TypeScript DTO types.

### Persistence & Idempotency

- Replace or extend in-memory entities with repository interfaces (`PaymentRepository`, `TransactionRepository`).
- Enforce unique key constraints on `idempotencyKey` at repository / database layer.

---

## 5. Architectural Diagram

```text
                      Integration Layer
               REST API / SDK / Frameworks
                            │
                            ▼
                     ┌──────────────┐
                     │ Payment Core │
                     │              │
                     │ Payment      │
                     │ Transaction  │
                     │ Registry     │
                     │ Capabilities │
                     │ Errors       │
                     └──────┬───────┘
                            │
                            ▼
                    Gateway Contract
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          MockGateway   [Zarinpal]     [Stripe]
          (Implemented)  (Phase 3)     (Phase 3)
```
