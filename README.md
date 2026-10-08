# @payment-platform/core

> Phase 1 — Core Foundation & Architecture for Multi-Gateway Payment Platform

This package provides the provider-independent core foundation, contracts, capability system, domain entities, and state machine for a scalable multi-gateway payment platform built with Node.js & TypeScript.

## Features

- **Provider-Independent Domain**: Zero coupling to specific PSP APIs (Zarinpal, Mellat, Stripe, etc.).
- **Capability-Based Contracts**: Modular capability interfaces (`CREATE_PAYMENT`, `VERIFY`, `INQUIRY`, `REFUND`, `REVERSE`, `WEBHOOK`).
- **Strict State Machine**: Governs payment status transitions and blocks illegal state changes.
- **Gateway Registry**: In-memory gateway manager supporting dynamic registration and capability validation.
- **Standardized Error System**: Granular error classes with predefined error codes and HTTP mapping hints.
- **MockGateway**: Built-in test gateway supporting configurable success and failure testing.

## Installation & Setup

```bash
npm install
```

## Available Scripts

- **Build Package**:
  ```bash
  npm run build
  ```
- **Type Check**:
  ```bash
  npm run typecheck
  ```
- **Run Unit Tests**:
  ```bash
  npm test
  ```
- **Lint Code**:
  ```bash
  npm run lint
  ```
- **Format Code**:
  ```bash
  npm run format
  ```

## Quick Start Example

```typescript
import {
  GatewayRegistry,
  MockGateway,
  PaymentCoreService,
  PaymentStatus,
} from '@payment-platform/core';

// 1. Initialize Gateway Registry & Register Adapters
const registry = new GatewayRegistry();
const mockGateway = new MockGateway({ id: 'mock-gw', enabled: true });
registry.registerGateway(mockGateway);

// 2. Initialize Core Service
const coreService = new PaymentCoreService(registry);

// 3. Create & Initiate Payment
const payment = coreService.createPaymentEntity({
  id: 'payment_1001',
  projectId: 'project_alpha',
  amount: 250000,
  currency: 'IRR',
  callbackUrl: 'https://my-app.com/payments/callback',
  gateway: 'mock-gw',
  description: 'Order #1001 payment',
});

const initiation = await coreService.initiatePayment(payment);
console.log('Payment Status:', initiation.payment.status); // PENDING
console.log('Redirect URL:', initiation.gatewayResponse.redirectUrl);

// 4. Verify Payment after Callback
const verification = await coreService.verifyPayment({
  payment: initiation.payment,
  gatewayTransactionId: initiation.transaction.gatewayTransactionId,
});

console.log('Final Status:', verification.payment.status); // SUCCESS
```

## Documentation

Comprehensive architecture details, domain design rules, and lifecycle documentation are available in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
