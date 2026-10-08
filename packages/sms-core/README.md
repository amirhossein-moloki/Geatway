# @amirhossein-moloki/sms-core

Provider-agnostic core domain, contracts, error handling, registry, and service orchestrator for SMS ecosystem integrations.

## Features

- **Capability-Based Provider Architecture**: Granular contracts (`SEND_SINGLE`, `SEND_BULK`, `SEND_LIKE_TO_LIKE`, `SEND_PATTERN`, `GET_DELIVERY`, `GET_BALANCE`, `GET_LINES`, `RECEIVE_MESSAGES`, `CANCEL_SCHEDULED`, `WEBHOOK`).
- **Provider-Agnostic Core Service**: `SmsService` orchestrates SMS operations across registered providers.
- **Unified Error Hierarchy**: Standardized domain and platform error types extending `SmsPlatformError`.
- **Dynamic Provider Registry**: `SmsProviderRegistry` for registering and retrieving active providers with capability checks.
