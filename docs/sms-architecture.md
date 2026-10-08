# SMS Panel Platform Architecture & Roadmap

## 1. Executive Summary & Core Responsibilities

The **SMS Panel Ecosystem** is a modular, provider-agnostic SMS orchestration platform for Node.js and TypeScript applications, modeled directly after the **Payment Core Platform**. Its primary purpose is to decouple application business logic from specific SMS Service Providers (e.g., Kavenegar, Ghasedak, MeliPayamak/FarazSMS, Magfa, etc.).

---

## 2. Monorepo Package Hierarchy

```text
Target Application (REST Controllers / DTOs / Business Rules)
        │
        ▼
@amirhossein-moloki/sms-service (Orchestration / Retries / Idempotency / Rate Limiting / Testing Mocks)
        │
        ▼
@amirhossein-moloki/sms-core (Domain Entities / Provider Contracts / Capabilities / Registry / Standard Errors)
        ▲                               ▲                               ▲
        │                               │                               │
@amirhossein-moloki/sms-provider-1    @amirhossein-moloki/sms-provider-2    @amirhossein-moloki/sms-provider-3
```

### Proposed Package Matrix

- **`@amirhossein-moloki/sms-core`**: Defines domain entities (`SmsMessage`, `SmsLog`, `SmsTemplate`), contracts (`SmsProvider`, capability interfaces), error hierarchies (`SmsPlatformError`), and `SmsProviderRegistry`. Zero external dependencies.
- **`@amirhossein-moloki/sms-service`**: Higher-level orchestration (`SmsApplicationService`), idempotency, rate limiting, retry policies, logging sanitization, and test mocks (`MockSmsProvider`).
- **`@amirhossein-moloki/sms-persistence-postgres`**: PostgreSQL implementation for storing sent SMS records, delivery statuses, idempotency locks, and inbound webhooks.
- **Provider Packages (`@amirhossein-moloki/sms-*`)**: Specific SMS gateway adapters implementing provider clients, request/response mappers, and capability interfaces.

---

## 3. Capability-Driven Design

SMS providers vary widely in features (pattern/OTP vs direct text vs delivery status vs balance inquiry). Capability interfaces restrict operations to supported features:

- `CanSendSms`: Direct text SMS sending (single/bulk).
- `CanSendPattern`: Pattern/Template based OTP and transaction messages.
- `CanGetDeliveryStatus`: Query delivery status by message ID or tracking code.
- `CanGetBalance`: Query provider account balance/credit.
- `CanHandleWebhook`: Handle inbound SMS or delivery callback webhooks.

---

## 4. Key Entities & Domain Models

- **`SmsMessage`**:
  - `id`: Standardized UUID (`sms_...`)
  - `provider`: Provider identifier (e.g. `kavenegar`)
  - `sender`: Line number or sender ID
  - `recipient`: E.164 or normalized phone number (`+989...` / `09...`)
  - `message`: Message text body (if direct)
  - `templateId`: Template identifier (if pattern-based)
  - `tokens`: Key-value map of pattern variables
  - `status`: `PENDING` | `SENT` | `DELIVERED` | `FAILED` | `REJECTED`
  - `providerMessageId`: Provider's reference/tracking ID
  - `cost`: Message cost/credit used
  - `createdAt`, `updatedAt`

---

## 5. Error Handling & Normalization

All errors inherit from `SmsPlatformError`:

- `SmsValidationError`: Invalid phone numbers, missing parameters.
- `SmsProviderError`: Gateway network errors, invalid API keys.
- `SmsProviderNotFoundError`: Requested provider ID not registered.
- `SmsUnsupportedCapabilityError`: Attempting pattern SMS on direct-only provider.
- `SmsQuotaExceededError`: Provider credit/balance insufficient.
- `SmsRateLimitError`: Application rate-limit throttled.
