# Payment Platform Core Foundation (@payment-platform/core)

Phase 1 implementation of the Core Payment Gateway Platform architecture in TypeScript and Node.js.

## Overview
This package provides a provider-agnostic core payment orchestration domain designed to handle Iranian and international payment gateways using capability-based gateway contracts, strict status transitions, standard error handling, and in-memory gateway registry.

## Features
- **Provider-Agnostic Core Domain**: Decoupled from specific provider APIs.
- **Capability-Based Gateway Contracts**: Gateways only declare and implement capabilities they support (`CREATE_PAYMENT`, `VERIFY`, `INQUIRY`, `REFUND`, `REVERSE`, `WEBHOOK`, `TOKENIZATION`, `RECURRING`).
- **Payment Lifecycle State Machine**: Enforces strict state transition rules for payments.
- **Gateway Registry**: In-memory registry for registering, enabling/disabling, and inspecting gateways and capabilities.
- **Standardized Error Hierarchy**: Error classes with error codes, HTTP status mapping, and JSON serialization.
- **Mock Gateway**: Built-in test gateway for contract validation.

## Installation & Setup

```bash
# Install dependencies
npm install

# Build TypeScript output
npm run build

# Run unit tests
npm test

# Check code formatting & linting
npm run lint
npm run format:check
```

## Architecture Documentation
For details on architectural decisions, state transitions, gateway capability contracts, and future extensions, see [ARCHITECTURE.md](./ARCHITECTURE.md).
