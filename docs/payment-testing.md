# Payment Package Ecosystem — Testing Guide

This guide details testing strategies, utilities, and sandbox configurations for verifying applications integrated with the payment package ecosystem.

---

## 1. Testing Architecture

Testing payment flows requires multi-level testing:

```text
Unit Tests (Mock Gateway, In-Memory Repos)
      ↓
Integration Tests (Local Server / Test HTTP Routes)
      ↓
Sandbox Provider Integration Tests (Network calls to PSP sandbox endpoints)
```

---

## 2. In-Memory Test Utilities

`@amirhossein-moloki/payment-service/testing` provides zero-dependency in-memory implementations and test helpers for rapid testing:

- **`InMemoryPaymentRepository`**: In-memory `PaymentRepository` with optimistic concurrency support.
- **`InMemoryTransactionRepository`**: In-memory `TransactionRepository`.
- **`InMemoryIdempotencyRepository`**: In-memory `IdempotencyRepository`.
- **`InMemoryWebhookEventRepository`**: In-memory `WebhookEventRepository`.
- **`MockGateway`**: Fully configurable deterministic mock gateway supporting all capabilities and scenarios (`'success'`, `'declined'`, `'timeout'`, `'network-error'`, `'provider-error'`, `'invalid-state'`, `'customer-action-required'`).
- **`createTestPaymentService`**: Factory helper that wires up an in-memory test environment instantly.

### Unit Testing Example

```ts
import { describe, it, expect } from 'vitest';
import { createTestPaymentService, MockGateway } from '@amirhossein-moloki/payment-service/testing';
import { PaymentStatus } from '@amirhossein-moloki/payment-core';

describe('Payment Flow Unit Test', () => {
  it('creates and verifies payment using MockGateway', async () => {
    const mockGateway = new MockGateway({
      id: 'mock-psp',
      scenario: 'success',
    });

    const { service } = createTestPaymentService({
      gateways: [mockGateway],
    });

    // 1. Create payment
    const createResult = await service.createPayment({
      gateway: 'mock-psp',
      amount: 50000,
      currency: 'IRR',
    });

    expect(createResult.status).toBe(PaymentStatus.PENDING);
    expect(createResult.redirectUrl).toBeDefined();

    // 2. Verify payment
    const verifyResult = await service.verifyPayment({
      paymentId: createResult.payment.id,
      gatewayTransactionId: createResult.gatewayTransactionId,
    });

    expect(verifyResult.status).toBe(PaymentStatus.SUCCESS);
  });
});
```

---

## 3. Sandbox Provider Integration Testing

When testing against live provider sandbox endpoints (e.g. Zibal, Zarinpal):

Set the environment variable `RUN_SANDBOX_TESTS=true` to enable sandbox suite execution:

```bash
RUN_SANDBOX_TESTS=true pnpm test
```

### Sandbox Configuration Rules

- **Zibal**: Merchant `'zibal'`, Environment `'sandbox'`.
- **Zarinpal**: Merchant `'46018260-8c88-11e5-80c7-000c295eb8fc'`, Environment `'sandbox'`.
