# Changelog - @amirhossein-moloki/payment-core

All notable changes to `@amirhossein-moloki/payment-core` will be documented in this file.

## [1.0.0] - initial release

### Added

- Domain entities: `Payment`, `Transaction`, `IdempotencyRecord`, `WebhookEvent`.
- Capability-based gateway interfaces (`CanCreatePayment`, `CanVerify`, `CanRefund`, `CanReverse`, `CanInquire`, `CanHandleCallback`, `CanHandleWebhook`).
- Core orchestrator service (`PaymentService`).
- Gateway registry (`GatewayRegistry`).
- Domain error hierarchy and status code abstractions.
