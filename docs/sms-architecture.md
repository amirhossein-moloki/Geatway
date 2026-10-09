# SMS Architecture Specification

## Overview

The SMS ecosystem is designed around strict separation between core SMS orchestrator logic, SMS provider packages, application integration layer, and the consuming application.

```text
┌─────────────────────────────────────────────────────────┐
│                   Consumer Application                  │
│       (REST / Fastify / Express API, Controllers)        │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
      SMS Commands / Inputs       OpenAPI Contract (openapi.yml)
                │                         │
┌───────────────▼─────────────────────────▼───────────────┐
│              Application Integration Layer              │
│                (@amirhossein-moloki/sms-core)           │
│  - SmsService                                           │
│  - SmsProviderRegistry                                  │
│  - Error Normalization & Capabilities Check             │
└───────────────┬─────────────────────────────────────────┘
                │
  ┌─────────────┴───────────────┐
  ▼                             ▼
@amirhossein-moloki/          @amirhossein-moloki/
sms-melipayamak               sms-smsir
```

## Architectural Boundaries

### 1. `@amirhossein-moloki/sms-core`

- Defines core SMS domain entities (`SmsMessage`, `SmsStatus`, `SmsType`).
- Defines capability-based contracts (`CanSendSingleSms`, `CanSendBulkSms`, `CanSendLikeToLikeSms`, `CanSendPatternSms`, `CanGetDeliveryStatus`, `CanGetBalance`, `CanGetLines`, `CanReceiveMessages`, `CanCancelScheduledSms`, `CanHandleSmsWebhook`).
- Manages `SmsProviderRegistry` for registering and resolving active providers.
- Standardizes normalized errors (`SmsPlatformError`, `SmsValidationError`, `SmsProviderNotFoundError`, `SmsProviderDisabledError`, `UnsupportedSmsCapabilityError`, `SmsProviderError`).
- Orchestrates SMS operations using `SmsService`.
- Contains **zero** provider-specific details or direct HTTP client network dependencies.

### 2. Provider Packages (`@amirhossein-moloki/sms-melipayamak`, `@amirhossein-moloki/sms-smsir`)

- Implement `SmsProvider` and specific capability interfaces.
- Perform network communication with Iranian SMS gateway HTTP/SOAP endpoints.
- Map domain requests to provider DTOs and provider raw responses back to normalized domain response interfaces.
- Provider packages depend **only** on `@amirhossein-moloki/sms-core` and never on each other.

### 3. Consumer Application

- Owns HTTP framework integration (Express, Fastify, NestJS, etc.).
- Exposes REST API endpoints and maintains its public `openapi.yml` specification.
- Instantiates provider implementations and registers them in `SmsProviderRegistry` upon application startup.

## Capability Matrix

| Capability          | Interface               | Melipayamak | SMS.ir |
| :------------------ | :---------------------- | :---------: | :----: |
| `SEND_SINGLE`       | `CanSendSingleSms`      |      ✓      |   ✓    |
| `SEND_BULK`         | `CanSendBulkSms`        |      ✓      |   ✓    |
| `SEND_LIKE_TO_LIKE` | `CanSendLikeToLikeSms`  |      ✓      |   ✓    |
| `SEND_PATTERN`      | `CanSendPatternSms`     |      ✓      |   ✓    |
| `GET_DELIVERY`      | `CanGetDeliveryStatus`  |      ✓      |   ✓    |
| `GET_BALANCE`       | `CanGetBalance`         |      ✓      |   ✓    |
| `GET_LINES`         | `CanGetLines`           |      ✓      |   ✓    |
| `RECEIVE_MESSAGES`  | `CanReceiveMessages`    |      ✓      |   ✓    |
| `CANCEL_SCHEDULED`  | `CanCancelScheduledSms` |      ✓      |   —    |
| `WEBHOOK`           | `CanHandleSmsWebhook`   |      ✓      |   ✓    |

_Legend: `✓` Supported | `—` Not Supported_

## Design Principles

1. **Provider Isolation**: Provider implementation details (such as API keys, Soap/REST endpoints, secret tokens) are strictly localized within provider packages.
2. **Capability Safety**: Operations are checked against capability interfaces at runtime before invocation. Attempting an unsupported action on a provider throws an `UnsupportedSmsCapabilityError`.
3. **Normalized Error Model**: All errors inherit from `SmsPlatformError` with consistent error codes and HTTP status code mappings.
