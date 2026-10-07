# Payment Integration Troubleshooting & Diagnostic Guide

This guide provides diagnostic procedures for resolving errors, misconfigurations, and edge cases encountered when integrating the payment package ecosystem.

---

## 1. Exception Hierarchy

All payment errors thrown by `@amirhossein-moloki/payment-core` or `@amirhossein-moloki/payment-service` extend `PaymentPlatformError`.

```text
PaymentPlatformError
 ├── ValidationError
 ├── ConfigurationError
 ├── GatewayError
 ├── GatewayNotFoundError
 ├── GatewayDisabledError
 ├── UnsupportedCapabilityError
 ├── PaymentError
 │    └── InvalidPaymentStateError
 ├── TransactionError
 └── PersistenceError
      ├── ConcurrencyError
      ├── PersistenceConflictError
      ├── RepositoryNotFoundError
      └── PersistenceUnavailableError
```

---

## 2. Core Diagnostic Matrix

| Error Class                  | Possible Root Cause                                                                                             | Diagnostic Steps                                                                   | Resolution                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ValidationError`            | Missing required field (`amount`, `gateway`, `currency`), or non-positive amount.                               | Check request body passed to `createPayment` or `verifyPayment`.                   | Ensure `amount > 0`, `currency` (e.g. `'IRR'`), and `gateway` (e.g. `'mellat'`) are provided. |
| `GatewayNotFoundError`       | The requested gateway ID has not been registered in `GatewayRegistry`.                                          | Inspect application startup code to see if `registry.register()` was called.       | Call `registry.register(gatewayInstance)` during application bootstrap.                       |
| `GatewayDisabledError`       | `gateway.isEnabled` is `false`.                                                                                 | Inspect gateway configuration and initialization.                                  | Ensure the gateway is enabled before registering.                                             |
| `UnsupportedCapabilityError` | Attempted an operation not supported by the provider (e.g., refund on Zibal).                                   | Check `provider-capabilities.md` or call `gateway.supportsCapability(capability)`. | Guard the feature in your application using `gateway.supportsCapability(...)`.                |
| `InvalidPaymentStateError`   | Attempted illegal state transition (e.g., verifying a payment that is not in `PENDING` or `CALLBACK_RECEIVED`). | Check `payment.status` before executing operation.                                 | Retrieve current payment entity via `getPayment()` to verify its state prior to transition.   |
| `GatewayError`               | The PSP rejected the request (e.g. invalid merchant credentials or bank error).                                 | Inspect `error.code`, `error.gatewayId`, and `error.message`.                      | See PSP-specific error tables below.                                                          |
| `ConcurrencyError`           | Optimistic locking failure (version mismatch during concurrent updates).                                        | Check if parallel requests updated the same payment concurrently.                  | Retry the operation using fresh payment entity version.                                       |

---

## 3. PSP Error Code Mapping

### 3.1. Mellat Error Codes

- **`11`**: Invalid card number.
- **`21`**: Merchant account invalid or disabled.
- **`34`**: System error or connection timeout.
- **`41`**: Duplicate transaction request (orderId already processed).
- **`43`**: Verify request already recorded / verified.
- **`48`**: Transaction has already been reversed.

### 3.2. Zibal Error Codes

- **`102`**: Merchant ID not found or disabled.
- **`103`**: Merchant inactive.
- **`104`**: Invalid merchant IP address.
- **`201`**: Already verified.
- **`202`**: TrackId not found or unpaid.

### 3.3. Zarinpal Error Codes

- **`-9`**: Validation error in request parameters.
- **`-11`**: Terminal / Merchant ID not found.
- **`-52`**: GraphQL / System error.
- **`101`**: Transaction already verified.

---

## 4. Common Integration Pitfalls

1. **Skipping Verification**:
   - _Symptom_: Fraudulent or unpaid orders marked as fulfilled.
   - _Fix_: Always call `paymentService.verifyPayment()` when callback is received. Never rely solely on browser callback query parameters.

2. **Hardcoding REST Endpoints**:
   - _Symptom_: Payment packages do not expose HTTP routes automatically.
   - _Fix_: Expose application REST endpoints in your web framework (Express/Fastify/NestJS) that delegate to `PaymentApplicationService`.

3. **Modifying `openapi.yml` for Package Internals**:
   - _Symptom_: Attempting to force package internal contracts into OpenAPI.
   - _Fix_: Treat `openapi.yml` as your application's public HTTP API contract. Update OpenAPI only when your application adds or alters its public HTTP endpoints.
