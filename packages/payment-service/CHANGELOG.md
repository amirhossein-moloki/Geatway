# Changelog - @amirhossein-moloki/payment-service

All notable changes to `@amirhossein-moloki/payment-service` will be documented in this file.

## [1.0.0] - initial release

### Added

- Application layer service (`PaymentApplicationService`).
- Idempotency protection and idempotency orchestrator.
- Configurable retry policies with exponential backoff and jitter.
- Timeout policy wrappers.
- Testing utilities (`MockGateway`, `TestGateway`, `InMemoryPaymentRepository`, `InMemoryTransactionRepository`).
