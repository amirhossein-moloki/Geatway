# SMS Architecture Specification

## Overview

The SMS platform is designed around strict separation between core SMS orchestrator logic, provider packages, application integration layer, and consuming applications.

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

## Repository Structure

```text
packages/
├── sms-core/                             # Core domain abstractions, contracts, registry, and service
│   ├── src/
│   │   ├── index.ts                      # Core public API exports
│   │   └── core/
│   │       ├── configuration/            # Configuration interface contracts
│   │       ├── contracts/                # SmsProvider and capability interfaces
│   │       ├── domain/                   # Entities (SmsMessage) and enums (SmsStatus, SmsCapability, SmsType)
│   │       ├── errors/                   # SmsPlatformError hierarchy
│   │       ├── registry/                 # SmsProviderRegistry implementation
│   │       └── services/                 # SmsService orchestrator
│   └── tests/                            # Core unit tests
├── sms-melipayamak/                      # Melipayamak SMS provider integration
│   ├── src/
│   │   ├── index.ts                      # Melipayamak public exports
│   │   ├── client/                       # MelipayamakClient HTTP implementation
│   │   ├── config/                       # MelipayamakConfig & validator
│   │   ├── errors/                       # MelipayamakErrorMapper
│   │   ├── mapper/                       # MelipayamakResponseMapper
│   │   ├── provider/                     # MelipayamakProvider implementation
│   │   └── types/                        # Raw API response interfaces
│   └── tests/                            # Melipayamak unit tests
└── sms-smsir/                            # SMS.ir Panel V2 provider integration
    ├── src/
    │   ├── index.ts                      # SMS.ir public exports
    │   ├── client/                       # SmsirClient HTTP implementation
    │   ├── config/                       # SmsirConfig & validator
    │   ├── errors/                       # SmsirErrorMapper
    │   ├── mapper/                       # SmsirResponseMapper
    │   ├── provider/                     # SmsirProvider implementation
    │   └── types/                        # Raw API DTOs
    └── tests/                            # SMS.ir unit tests
examples/
└── sms-integration/                      # Reference integration example application
    ├── src/index.ts                      # Express/Fastify-style application controller example
    ├── openapi.yml                       # OpenAPI 3.0 specification
    └── tests/sms-integration.test.ts     # Integration tests with MockSmsProvider
```

## Major Components & Source Mapping

| Component                    | Responsibility                                                                                                       | Source File                                                      |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| `SmsMessage`                 | Core entity managing recipient list, text content, provider selection, type, and state transitions.                  | `packages/sms-core/src/core/domain/sms/sms-message.entity.ts`    |
| `SmsProvider`                | Base interface declared by all provider adapters.                                                                    | `packages/sms-core/src/core/contracts/sms-provider.interface.ts` |
| Capability Interfaces        | Fine-grained interfaces (`CanSendSingleSms`, `CanSendPatternSms`, `CanGetBalance`, etc.) gating provider operations. | `packages/sms-core/src/core/contracts/sms-provider.interface.ts` |
| `SmsProviderRegistry`        | Thread-safe in-memory map of active provider instances with capabilities checking.                                   | `packages/sms-core/src/core/registry/sms-provider.registry.ts`   |
| `SmsService`                 | Orchestrator validating provider capabilities and executing provider requests.                                       | `packages/sms-core/src/core/services/sms.service.ts`             |
| `SmsPlatformError` Hierarchy | Standardized error classes mapping internal and provider failures to HTTP status codes.                              | `packages/sms-core/src/core/errors/index.ts`                     |
| `MelipayamakProvider`        | Melipayamak provider implementation.                                                                                 | `packages/sms-melipayamak/src/provider/melipayamak-provider.ts`  |
| `SmsirProvider`              | SMS.ir V2 provider implementation.                                                                                   | `packages/sms-smsir/src/provider/smsir-provider.ts`              |

## Request Trace Flow

Tracing a single SMS request (`smsService.sendSingle`):

```text
1. Consumer App creates SmsMessage({ provider: 'smsir', recipients: ['09123456789'], messageTexts: ['Hello'] })
2. Consumer App calls smsService.sendSingle(message)
3. SmsService validates message.provider exists on the entity (throws SmsValidationError if missing)
4. SmsService requests active provider: registry.getActiveProvider('smsir', SmsCapability.SEND_SINGLE)
   a. Registry verifies 'smsir' is registered (throws SmsProviderNotFoundError if missing)
   b. Registry verifies provider isEnabled === true (throws SmsProviderDisabledError if disabled)
   c. Registry verifies provider.supportsCapability(SmsCapability.SEND_SINGLE) (throws UnsupportedSmsCapabilityError if false)
5. SmsService invokes provider.sendSingle({ message, options })
6. SmsirProvider formats request payload and calls SmsirClient.sendBulk(...)
7. SmsirClient sends HTTP POST request to SMS.ir API endpoint
8. SmsirProvider checks HTTP response status:
   - If status !== 1, SmsirErrorMapper maps response code to appropriate SmsPlatformError (e.g. SmsProviderError)
   - If status === 1, SmsirResponseMapper maps raw DTO to SendSmsResponse DTO
9. SmsService receives response:
   - On success: message.transitionTo(SmsStatus.SENT)
   - On failure: message.transitionTo(SmsStatus.FAILED)
10. SmsService returns { message, response }
```

## Runtime Behaviors & Safety Guards

- **Missing Provider:** Requesting a non-existent provider ID from `SmsProviderRegistry` throws `SmsProviderNotFoundError` (HTTP 404).
- **Disabled Provider:** Requesting a provider initialized with `isEnabled: false` throws `SmsProviderDisabledError` (HTTP 422).
- **Unsupported Capability:** Invoking an operation that the provider does not implement or support throws `UnsupportedSmsCapabilityError` (HTTP 422).
- **Invalid Input / Validation Error:** Passing incomplete DTO parameters (missing line number, empty recipient list, etc.) throws `SmsValidationError` (HTTP 400).

## Provider Capability Matrix

Capabilities verified directly against source code implementations:

| Capability          | Interface               | Melipayamak | SMS.ir |
| :------------------ | :---------------------- | :---------: | :----: |
| `SEND_SINGLE`       | `CanSendSingleSms`      |      ✓      |   ✓    |
| `SEND_BULK`         | `CanSendBulkSms`        |      —      |   ✓    |
| `SEND_LIKE_TO_LIKE` | `CanSendLikeToLikeSms`  |      —      |   ✓    |
| `SEND_PATTERN`      | `CanSendPatternSms`     |      ✓      |   ✓    |
| `GET_DELIVERY`      | `CanGetDeliveryStatus`  |      ✓      |   ✓    |
| `GET_BALANCE`       | `CanGetBalance`         |      ✓      |   ✓    |
| `GET_LINES`         | `CanGetLines`           |      ✓      |   ✓    |
| `RECEIVE_MESSAGES`  | `CanReceiveMessages`    |      ✓      |   ✓    |
| `CANCEL_SCHEDULED`  | `CanCancelScheduledSms` |      —      |   ✓    |
| `WEBHOOK`           | `CanHandleSmsWebhook`   |      —      |   —    |

_Legend: `✓` Verified Supported | `—` Verified Unsupported_

## Error Hierarchy

All errors extend `SmsPlatformError`:

```text
SmsPlatformError (HTTP 500)
├── SmsValidationError (HTTP 400)
├── SmsProviderNotFoundError (HTTP 404)
├── SmsProviderDisabledError (HTTP 422)
├── UnsupportedSmsCapabilityError (HTTP 422)
├── SmsProviderError (HTTP 502)
└── SmsConfigurationError (HTTP 500)
```

## Design Principles

1. **Provider Isolation**: Provider details (SOAP/REST endpoints, API tokens) are strictly isolated inside provider packages.
2. **Capability Safety**: Operations are validated against declared capabilities at runtime prior to execution.
3. **Normalized Error Model**: All failures return normalized `SmsPlatformError` exceptions with appropriate HTTP status codes.
