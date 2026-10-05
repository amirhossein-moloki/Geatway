# @company/payment-core

`@company/payment-core` is the foundation of the Payment Platform. It provides a provider-agnostic domain layer, gateway capability contracts, lifecycle state machine, error hierarchy, and in-memory gateway registry.

## Key Concepts

### 1. Payment Domain & Lifecycle

- Standard `Payment` entity with provider-independent attributes (`id`, `amount`, `currency`, `status`, `description`, `metadata`, `createdAt`, `updatedAt`).
- Lifecycle status state machine (`CREATED`, `PENDING`, `REDIRECTED`, `CALLBACK_RECEIVED`, `SUCCESS`, `FAILED`, `CANCELLED`, `REVERSED`, `REFUNDED`).

### 2. Capability System

Gateways declare capabilities via `GatewayCapability` flags:

- `CREATE_PAYMENT`
- `VERIFY`
- `INQUIRY`
- `REFUND`
- `REVERSE`
- `CALLBACK`
- `WEBHOOK`
- `TOKENIZATION`
- `RECURRING`

### 3. Gateway Registry

`GatewayRegistry` manages active gateways without hardcoding provider classes:

```ts
import { GatewayRegistry } from '@company/payment-core';

const registry = new GatewayRegistry();
registry.register(mellatGateway);

const gateway = registry.getActiveGateway('mellat', GatewayCapability.CREATE_PAYMENT);
```

### 4. Error Hierarchy

Standard errors with HTTP status codes and JSON serialization:

- `PaymentError` / `InvalidPaymentStateError`
- `GatewayError` / `GatewayNotFoundError` / `GatewayDisabledError`
- `UnsupportedCapabilityError`
- `ValidationError`
- `ConfigurationError`
- `TransactionError`

### 5. Idempotency Abstraction

Abstract `IdempotencyStore` interface with built-in `InMemoryIdempotencyStore` for state management and caching.

## Usage Example

```ts
import { Payment, PaymentService, GatewayRegistry, PaymentStatus } from '@company/payment-core';

const registry = new GatewayRegistry();
// register provider gateway instance...

const service = new PaymentService(registry);

const payment = new Payment({
  amount: 500000,
  currency: 'IRR',
  description: 'Order #1001',
  gateway: 'mellat',
});

const result = await service.createPayment(payment);
console.log(result.response.redirectUrl);
```
