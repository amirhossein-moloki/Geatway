# Payment Gateway Platform - Core Architecture Documentation (Phase 1)

## 1. Overview & High-Level Architecture
The Payment Core Foundation is designed as a language-agnostic, provider-independent payment processing engine. Its primary goal is to standardize payment operations across multiple payment service providers (PSPs) both Iranian (e.g. Zarinpal, Mellat, Saman) and International (e.g. Stripe, PayPal, Adyen) without coupling core payment logic to any provider-specific API implementation.

```
                      Integration Layer
                   (REST API / SDK / CLI)
                             │
                             ▼
               ┌───────────────────────────┐
               │       Payment Core        │
               │                           │
               │  - Payment Domain         │
               │  - Transaction Domain     │
               │  - Gateway Registry       │
               │  - Capability Engine      │
               │  - Status State Machine   │
               │  - Error System           │
               └─────────────┬─────────────┘
                             │
                             ▼
                   Gateway Contract (Interface)
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     Gateway Adapter A  Gateway Adapter B  Gateway Adapter C
```

---

## 2. Core Responsibilities vs. Gateway Adapters
- **Payment Core**:
  - Manages the lifecycle of payment requests (`Payment`) and transaction logs (`Transaction`).
  - Enforces strict status transitions (`PaymentStatusMachine`).
  - Manages registered payment gateways (`GatewayRegistry`).
  - Verifies whether a requested operation is supported by the gateway (`GatewayCapability`).
  - Standardizes platform errors (`PaymentPlatformError`).
  - Provides extension points for future persistence, idempotency, routing, and SDK layers.

- **Gateway Adapter**:
  - Implements the standard `PaymentGateway` contracts and optional capability interfaces (`CanCreatePayment`, `CanVerifyPayment`, `CanRefundPayment`, etc.).
  - Translates standardized platform requests into provider-specific HTTP/RPC payloads.
  - Translates provider-specific responses and error codes into standardized responses or `GatewayError`s.
  - Contains **zero** core business logic.

---

## 3. Why the Core is Provider-Agnostic
Directly referencing provider SDKs or endpoints inside the Core causes tight coupling, fragile code, and prevents scaling across dozens of payment gateways. By abstracting PSP interaction behind modular capability contracts:
1. Core services do not know whether a gateway is Zarinpal, Stripe, or Mellat.
2. New gateways can be added in future phases without modifying a single line of core code (Open-Closed Principle).
3. Gateways with radically different API structures (redirect-based vs API-direct, webhook-driven vs callback-driven) can coexist under a unified platform interface.

---

## 4. Capability-Based Gateway Architecture
Not all payment gateways support every payment operation. For instance, an Iranian gateway might support `VERIFY` and `REVERSE` but lack `TOKENIZATION` or `RECURRING` payments.

Instead of defining a single bloated interface with unimplemented methods, the Core uses fine-grained, capability-based interfaces:

- `CREATE_PAYMENT` -> `CanCreatePayment`
- `VERIFY` -> `CanVerifyPayment`
- `INQUIRY` -> `CanInquirePayment`
- `REFUND` -> `CanRefundPayment`
- `REVERSE` -> `CanReversePayment`
- `WEBHOOK` -> `CanHandleWebhook`
- `TOKENIZATION`
- `RECURRING`

Before dispatching an operation, `GatewayRegistry` and `PaymentCoreService` check `gateway.capabilities.has(capability)`. If missing, an `UnsupportedCapabilityError` is immediately thrown without executing an invalid call.

---

## 5. Payment Lifecycle & Status State Machine
Payments follow a strictly defined state machine:

```
                  ┌───────────────┐
                  │    CREATED    │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
          ┌───────│    PENDING    │───────┐
          │       └───────┬───────┘       │
          ▼               │               ▼
  ┌───────────────┐       │       ┌───────────────┐
  │   REDIRECTED  │───────┤       │    FAILED     │
  └───────┬───────┘       │       └───────────────┘
          │               │               ▲
          ▼               ▼               │
  ┌───────────────────────────────┐       │
  │       CALLBACK_RECEIVED       │───────┘
  └───────────────┬───────────────┘
                  │
                  ▼
          ┌───────────────┐
          │    SUCCESS    │
          └───────┬───────┘
            ┌─────┴─────┐
            ▼           ▼
     ┌───────────┐ ┌───────────┐
     │  REFUNDED │ │  REVERSED │
     └───────────┘ └───────────┘
```

- **Terminal States**: `FAILED`, `CANCELLED`, `REFUNDED`, `REVERSED`. Once a payment enters a terminal state, illegal transitions (such as returning to `CREATED` or `PENDING`) are prevented by `PaymentStatusMachine`.

---

## 6. How New Gateways Will Be Added in Future Phases
To add a new Gateway (e.g. `ZarinpalGatewayAdapter` or `StripeGatewayAdapter` in Phase 3):
1. Create a package/module outside `@payment-platform/core`.
2. Implement `PaymentGateway` and specific capability interfaces:
   ```typescript
   export class ZarinpalGatewayAdapter implements PaymentGateway, CanCreatePayment, CanVerifyPayment {
     public readonly id = 'zarinpal';
     public readonly capabilities = new Set([GatewayCapability.CREATE_PAYMENT, GatewayCapability.VERIFY]);
     ...
   }
   ```
3. Register the adapter into `GatewayRegistry`:
   ```typescript
   registry.registerGateway(new ZarinpalGatewayAdapter(config));
   ```

---

## 7. How REST API and SDK Will Be Built on Top of Core
- **REST API Layer (Phase 2/3)**:
  - Controllers receive HTTP requests from external systems/projects.
  - Maps HTTP payload into `CreatePaymentDTO` / `VerifyPaymentDTO`.
  - Invokes `PaymentCoreService`.
  - Maps `PaymentPlatformError` instances to HTTP status codes (`400`, `422`, `444`, `502`, etc.).
- **Client SDKs**:
  - Provides typed language wrappers (TypeScript, Python, Go, PHP, C#) consuming the REST API.
