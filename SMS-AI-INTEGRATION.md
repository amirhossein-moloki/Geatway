# SMS AI Integration Guide & Authoritative Contract

> **Authoritative Contract for AI Coding Agents**
> This document is the single source of truth and integration contract for any AI Coding Agent integrating the SMS Package Ecosystem into target consumer applications.
> While this document serves as the authoritative integration guide, the actual source code and public TypeScript package exports remain the ultimate ground truth for implementation behavior and API signatures.

---

## 1. What This SMS Ecosystem Is

This SMS Package Ecosystem is a modular, capability-driven SMS panel integration library built for Node.js and TypeScript applications.

Key characteristics:

- **Provider Agnostic:** Exposes uniform domain interfaces (`SmsMessage`, `SmsStatus`, `SmsType`, `SmsProvider`, `SmsProviderRegistry`, `SmsService`) so consumer applications interact with standard contracts regardless of the underlying Iranian SMS gateway panel (e.g. Melipayamak, SMS.ir).
- **Capability-Driven:** SMS operations are gated by explicit capability interfaces (`CanSendSingleSms`, `CanSendBulkSms`, `CanSendLikeToLikeSms`, `CanSendPatternSms`, `CanGetDeliveryStatus`, `CanGetBalance`, `CanGetLines`, `CanReceiveMessages`, `CanCancelScheduledSms`, `CanHandleSmsWebhook`).
- **Library, Not Application:** The ecosystem consists of headless library packages. It does **not** expose public HTTP servers or REST controllers on its own; those responsibilities belong to the consumer target application.

---

## 2. Source of Truth & Verification Hierarchy

When integrating or resolving questions about package behavior, follow this strict hierarchy:

1. **Actual Source Code** (`packages/sms-*/src/...`)
2. **Public TypeScript Package Exports** (`src/index.ts` and `package.json` `exports`)
3. **Automated Unit & Integration Test Suites** (`packages/sms-*/tests/...`)
4. **Package Metadata** (`package.json`)
5. **Provider Specifications & Documents** (`Melipayamak.md`, `SMS.ir Panel V2-PostmanCollection.json`)
6. **Existing Human Documentation** (`docs/sms-*.md`)

_Rule:_ Existing human documentation cannot authorize or validate an API signature or feature claim that actual source code or public exports do not confirm.

---

## 3. Package Architecture

The monorepo architecture strictly isolates concerns across layer boundaries:

```text
Target Application (REST Controllers / DTOs / Business Rules)
        │
        ▼
@amirhossein-moloki/sms-core (SmsService / SmsProviderRegistry / Domain Entities / Error Hierarchy)
        ▲                                                      ▲
        │                                                      │
@amirhossein-moloki/sms-melipayamak                    @amirhossein-moloki/sms-smsir
```

### Layer Responsibilities

- **`@amirhossein-moloki/sms-core`**: Defines domain entities (`SmsMessage`, `SmsStatus`, `SmsType`, `SmsCapability`), provider contracts (`SmsProvider`, capability interfaces), error hierarchy (`SmsPlatformError`), provider registry (`SmsProviderRegistry`), and orchestrator service (`SmsService`). Zero external SMS provider network dependencies.
- **Provider Packages** (`@amirhossein-moloki/sms-melipayamak`, `@amirhossein-moloki/sms-smsir`): Implement provider HTTP clients, request/response mappers, error mappers, and capabilities. Depend **only** on `@amirhossein-moloki/sms-core`. Provider packages NEVER depend on each other.
- **Target Application**: Implements HTTP controllers, REST routes, DTOs, request validation, authentication, authorization, business rules, OpenAPI specs, and wiring.

---

## 4. Dependency Rules

- **No Circular Dependencies:** Core has no provider dependencies. Providers depend only on Core.
- **No Provider Dependencies Between Providers:** `@amirhossein-moloki/sms-melipayamak` never imports from `@amirhossein-moloki/sms-smsir`, etc.
- **Public Imports Only:** Target applications must import from top-level package exports (e.g., `import { SmsService } from '@amirhossein-moloki/sms-core'`). Never import internal source paths like `@amirhossein-moloki/sms-smsir/src/...`.

---

## 5. Package Selection

Target applications should install only the packages required for their specific implementation:

| Package Name                          |   Required   | Purpose / Responsibility                                                                 | Dependencies                   |
| :------------------------------------ | :----------: | :--------------------------------------------------------------------------------------- | :----------------------------- |
| `@amirhossein-moloki/sms-core`        | **Required** | Core domain entities, capability contracts, error hierarchy, registry, and `SmsService`. | None                           |
| `@amirhossein-moloki/sms-melipayamak` |   Optional   | Melipayamak SMS Panel gateway provider implementation.                                   | `@amirhossein-moloki/sms-core` |
| `@amirhossein-moloki/sms-smsir`       |   Optional   | SMS.ir Panel V2 gateway provider implementation.                                         | `@amirhossein-moloki/sms-core` |

---

## 6. Installation & Package Registries

Target applications consume packages published to GitHub Packages (`https://npm.pkg.github.com`).

### Consumer `.npmrc` Configuration

Consumer projects configure `.npmrc` to authenticate with GitHub Packages:

```ini
@amirhossein-moloki:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Installation Commands

Install required scoped packages via your package manager:

```bash
# Core orchestrator and selected provider packages
pnpm add @amirhossein-moloki/sms-core @amirhossein-moloki/sms-melipayamak @amirhossein-moloki/sms-smsir
```

---

## 7. Runtime & TypeScript Requirements

- **Node.js:** `>=18.0.0`
- **TypeScript:** `>=5.0.0` (Target `ES2022` or later, `moduleResolution: "nodenext"` or `"node16"`)

---

## 8. Configuration

Each provider package exports a typed configuration interface and validation function (`validateMelipayamakConfig`, `validateSmsirConfig`).

### Melipayamak Configuration (`MelipayamakConfig`)

```ts
export interface MelipayamakConfig {
  readonly providerId?: string; // Defaults to 'melipayamak'
  readonly username: string;
  readonly password: string;
  readonly from?: string;
  readonly isEnabled?: boolean;
}
```

### SMS.ir Configuration (`SmsirConfig`)

```ts
export interface SmsirConfig {
  readonly providerId?: string; // Defaults to 'smsir'
  readonly apiKey: string;
  readonly lineNumber?: string;
  readonly isEnabled?: boolean;
}
```

---

## 9. Environment Variables

Store credentials securely in environment variables.

| Environment Variable      |   Required / Optional    | Consumer Package                      | Purpose                    | Secret? |
| :------------------------ | :----------------------: | :------------------------------------ | :------------------------- | :-----: |
| `MELIPAYAMAK_USERNAME`    | Required for Melipayamak | `@amirhossein-moloki/sms-melipayamak` | Panel username             |   Yes   |
| `MELIPAYAMAK_PASSWORD`    | Required for Melipayamak | `@amirhossein-moloki/sms-melipayamak` | Panel password             |   Yes   |
| `MELIPAYAMAK_LINE_NUMBER` | Optional for Melipayamak | `@amirhossein-moloki/sms-melipayamak` | Default sender line number |   No    |
| `SMSIR_API_KEY`           |   Required for SMS.ir    | `@amirhossein-moloki/sms-smsir`       | API key token              |   Yes   |
| `SMSIR_LINE_NUMBER`       |   Optional for SMS.ir    | `@amirhossein-moloki/sms-smsir`       | Default sender line number |   No    |

---

## 10. Provider Registration

Providers are instantiated and explicitly registered into an instance of `SmsProviderRegistry`.

```ts
import { SmsProviderRegistry, SmsService } from '@amirhossein-moloki/sms-core';
import { MelipayamakProvider } from '@amirhossein-moloki/sms-melipayamak';
import { SmsirProvider } from '@amirhossein-moloki/sms-smsir';

export function configureSmsService(): SmsService {
  const registry = new SmsProviderRegistry();

  const melipayamak = new MelipayamakProvider({
    username: process.env.MELIPAYAMAK_USERNAME!,
    password: process.env.MELIPAYAMAK_PASSWORD!,
    from: process.env.MELIPAYAMAK_LINE_NUMBER,
  });
  registry.register(melipayamak);

  const smsir = new SmsirProvider({
    apiKey: process.env.SMSIR_API_KEY!,
    lineNumber: process.env.SMSIR_LINE_NUMBER,
  });
  registry.register(smsir);

  return new SmsService(registry);
}
```

### Registry Behavior

- `register(provider)`: Registers provider. Throws `SmsConfigurationError` if provider ID is already registered.
- `getProvider(id)`: Returns provider or throws `SmsProviderNotFoundError`.
- `getActiveProvider(id, capability?)`: Returns enabled provider or throws `SmsProviderNotFoundError`, `SmsProviderDisabledError`, or `UnsupportedSmsCapabilityError`.

---

## 11. Sending Single SMS

Single SMS messages are sent via `smsService.sendSingle(message)`.

```ts
import { SmsMessage, SmsType } from '@amirhossein-moloki/sms-core';

const message = new SmsMessage({
  provider: 'smsir',
  type: SmsType.SINGLE,
  recipients: ['09123456789'],
  messageTexts: ['Welcome to our service!'],
});

const result = await smsService.sendSingle(message);
console.log(result.response.success); // boolean
console.log(result.response.messageId); // string | number
console.log(result.message.status); // SmsStatus.SENT
```

---

## 12. Sending Bulk SMS

Bulk SMS dispatches a single text message to multiple recipient numbers (supported by SMS.ir):

```ts
const bulkResponse = await smsService.sendBulk('smsir', {
  messageText: 'Special holiday discount available now!',
  mobiles: ['09121111111', '09122222222'],
});

console.log(bulkResponse.success);
console.log(bulkResponse.packId);
```

_Note:_ `sendBulk` is supported by SMS.ir (`@amirhossein-moloki/sms-smsir`). Calling `sendBulk` on Melipayamak throws `UnsupportedSmsCapabilityError`.

---

## 13. Sending Like-to-Like SMS

Like-to-Like SMS sends individual messages to corresponding recipients in parallel (supported by SMS.ir):

```ts
const response = await smsService.sendLikeToLike('smsir', {
  messageTexts: ['Hello Ali, balance: $50', 'Hello Reza, balance: $100'],
  mobiles: ['09121111111', '09122222222'],
});

console.log(response.packId);
```

_Note:_ Supported by SMS.ir. Calling on Melipayamak throws `UnsupportedSmsCapabilityError`.

---

## 14. Sending Pattern / OTP SMS

Pattern SMS sends operational templated messages (e.g. OTP verification codes):

```ts
const otpResponse = await smsService.sendPattern('smsir', {
  mobile: '09123456789',
  templateId: 100000,
  parameters: [{ name: 'CODE', value: '482019' }],
});

console.log(otpResponse.messageId);
```

_Supported by:_ Both `@amirhossein-moloki/sms-melipayamak` and `@amirhossein-moloki/sms-smsir`.

---

## 15. Checking Delivery Status

Query the current delivery status for a message or batch pack ID:

```ts
const deliveryStatus = await smsService.getDeliveryStatus('smsir', {
  messageId: 12345678,
});

console.log(deliveryStatus.statuses[0]?.deliveryStatus);
```

---

## 16. Checking Account Balance

Query remaining credit balance from a provider:

```ts
const balanceResult = await smsService.getBalance('melipayamak');
console.log('Credit balance:', balanceResult.balance);
```

---

## 17. Fetching Available Lines

Retrieve configured sender phone lines:

```ts
const linesResult = await smsService.getLines('smsir');
console.log('Available lines:', linesResult.lines);
```

---

## 18. Receiving Messages

Retrieve inbox messages sent to your panel number:

```ts
const incomingMessages = await smsService.receiveMessages('melipayamak', {
  count: 20,
});

console.log('Received count:', incomingMessages.messages.length);
```

---

## 19. Canceling Scheduled Messages

Cancel a scheduled bulk dispatch prior to execution (supported by SMS.ir):

```ts
const cancelResult = await smsService.cancelScheduled('smsir', {
  packId: 'pack_12345',
});

console.log('Returned credits:', cancelResult.returnedCreditCount);
```

_Note:_ Supported by SMS.ir. Calling on Melipayamak throws `UnsupportedSmsCapabilityError`.

---

## 20. Webhook Processing Status

> **CAPABILITY NOTICE:** The `CanHandleSmsWebhook` capability interface and `smsService.parseWebhook()` method exist in `@amirhossein-moloki/sms-core`. However, neither `@amirhossein-moloki/sms-melipayamak` nor `@amirhossein-moloki/sms-smsir` currently implements `parseWebhook`. Invoking `parseWebhook` on either existing provider will throw an `UnsupportedSmsCapabilityError`.

---

## 21. Error Handling

All SMS ecosystem errors inherit from `SmsPlatformError`.

### Error Hierarchy

- `SmsPlatformError` (Base class, statusCode defaults to 500)
  - `SmsValidationError` (HTTP 400) - Missing or invalid input parameters.
  - `SmsProviderNotFoundError` (HTTP 404) - Provider ID not registered in `SmsProviderRegistry`.
  - `SmsProviderDisabledError` (HTTP 422) - Provider `isEnabled` is false.
  - `UnsupportedSmsCapabilityError` (HTTP 422) - Requested capability not supported by provider.
  - `SmsProviderError` (HTTP 502) - Provider HTTP/SOAP API error.
  - `SmsConfigurationError` (HTTP 500) - Misconfigured provider settings.

---

## 22. REST API Integration

> **CRITICAL RULE:** SMS packages are headless libraries and do NOT automatically expose REST API routes.

Target applications are fully responsible for HTTP controllers, routes, request validation, authentication, and DTO definitions.

### Reference Endpoints Pattern

- `POST /api/v1/sms/send-otp` - Send OTP code via pattern
- `POST /api/v1/sms/send-single` - Send single text message
- `GET /api/v1/sms/balance` - Retrieve credit balance

---

## 23. OpenAPI Integration

When AI agents add or modify REST SMS endpoints in a target project, they **MUST** update the target application's `openapi.yml` or OpenAPI specification file accordingly. Sensitive credentials (`apiKey`, `password`) MUST NEVER be exposed in OpenAPI schemas.

---

## 24. Testing with Mock SMS Providers

Target applications should write tests using custom `MockSmsProvider` classes conforming to `SmsProvider` interfaces without invoking live network APIs.

```ts
import { SmsProvider, SmsCapability, SmsStatus } from '@amirhossein-moloki/sms-core';

export class MockSmsProvider implements SmsProvider {
  readonly id = 'mock-sms';
  readonly displayName = 'Mock SMS Provider';
  readonly isEnabled = true;
  readonly capabilities = new Set([SmsCapability.SEND_SINGLE, SmsCapability.SEND_PATTERN]);

  supportsCapability(cap: SmsCapability) {
    return this.capabilities.has(cap);
  }

  async sendSingle() {
    return { success: true, messageId: 101, status: SmsStatus.SENT };
  }

  async sendPattern() {
    return { success: true, messageId: 202, status: SmsStatus.SENT };
  }
}
```

---

## 25. Provider Capability Matrix

Capabilities verified directly from source code implementation:

| Provider Package                      | `SEND_SINGLE` | `SEND_BULK` | `SEND_LIKE_TO_LIKE` | `SEND_PATTERN` | `GET_DELIVERY` | `GET_BALANCE` | `GET_LINES` | `RECEIVE_MESSAGES` | `CANCEL_SCHEDULED` | `WEBHOOK` |
| :------------------------------------ | :-----------: | :---------: | :-----------------: | :------------: | :------------: | :-----------: | :---------: | :----------------: | :----------------: | :-------: |
| `@amirhossein-moloki/sms-melipayamak` |       ✓       |      —      |          —          |       ✓        |       ✓        |       ✓       |      ✓      |         ✓          |         —          |     —     |
| `@amirhossein-moloki/sms-smsir`       |       ✓       |      ✓      |          ✓          |       ✓        |       ✓        |       ✓       |      ✓      |         ✓          |         ✓          |     —     |

_Legend: `✓` Verified Supported | `—` Verified Not Supported_

---

## 26. Common AI Failure Modes

1. **Inventing Non-Existent Capabilities:** Attempting to call `sendBulk`, `sendLikeToLike`, `cancelScheduled`, or `parseWebhook` on Melipayamak, or calling `parseWebhook` on SMS.ir.
2. **Importing Internal Paths:** Using `import { SmsirProvider } from '@amirhossein-moloki/sms-smsir/src/provider/smsir-provider'`.
3. **Hardcoding Credentials:** Embedding API keys, passwords, or phone numbers in source files.
4. **Bypassing OpenAPI Updates:** Creating or modifying REST controllers without updating `openapi.yml`.
5. **Ignoring Capabilities:** Calling capabilities without checking `provider.supportsCapability()` or verifying the provider capability matrix.

---

## 27. AI Agent Decision Rules

```text
Need SMS Integration?
        │
        ▼
Inspect Target Project Architecture & Framework
        │
        ▼
Identify Required SMS Provider(s)
        │
Is Provider Package Installed?
    ├── No ──► Install required package only
    └── Yes
        │
        ▼
Inspect Public Package Exports (@amirhossein-moloki/sms-core)
        │
        ▼
Check Provider Capability Matrix
        │
        ▼
Configure Environment Variables (.env.example)
        │
        ▼
Initialize SmsProviderRegistry & Register Providers
        │
        ▼
Setup SmsService
        │
        ▼
Implement REST Endpoints (Send OTP, Single, Balance)
        │
        ▼
Update OpenAPI Specification
        │
        ▼
Add Deterministic Unit Tests using MockSmsProvider
        │
        ▼
Execute Validation (Typecheck, Lint, Tests)
```

---

## 28. Procedure for Adding a New SMS Provider

To add a new SMS provider (e.g. `@amirhossein-moloki/sms-kavenegar`), follow this exact architectural procedure:

1. **Create Package Directory:** `packages/sms-<provider>` depending strictly on `@amirhossein-moloki/sms-core`.
2. **Define Configuration Interface:** Export typed config (e.g. `<Provider>Config`) and validator function `validate<Provider>Config` checking required credentials.
3. **Implement API Client:** Build an HTTP client for the provider's REST/SOAP API with configurable timeout and credentials.
4. **Implement Response and Error Mappers:**
   - `<Provider>ResponseMapper`: Converts raw API responses to `SendSmsResponse`, `SendPatternSmsResponse`, etc.
   - `<Provider>ErrorMapper`: Maps raw API status/error codes to `SmsProviderError`, `SmsValidationError`, or `SmsConfigurationError`.
5. **Implement Provider Class:**
   - Implement `SmsProvider` and target capability interfaces (`CanSendSingleSms`, `CanSendPatternSms`, etc.).
   - Define `id`, `displayName`, `isEnabled`, and `capabilities` set matching implemented capabilities.
6. **Export Public API:** Export classes, interfaces, and error mappers in `src/index.ts`.
7. **Write Unit Tests:** Add unit tests in `tests/` mocking the HTTP client or transport layer.
8. **Register in Consumer Application:** Instantiate the new provider and register it in `SmsProviderRegistry`.

---

## 29. AI Agent Rules

1. **Rule 1 — Never Invent APIs:** Use only classes, interfaces, and methods verified in public package exports.
2. **Rule 2 — Inspect Before Coding:** Always inspect target application files and exports before making changes.
3. **Rule 3 — Respect Layer Isolation:** Do not add provider-specific logic into `@amirhossein-moloki/sms-core`.
4. **Rule 4 — Verify Capability:** Check provider capability matrix before invoking operations.
5. **Rule 5 — Use Public Exports:** Import only from top-level package entrypoints (`@amirhossein-moloki/sms-core`).
6. **Rule 6 — Preserve Target Architecture:** Match the target project's existing coding standards and framework patterns.
7. **Rule 7 — Never Expose Secrets:** Keep credentials in environment variables; never commit secrets or leak them in OpenAPI specs.
8. **Rule 8 — Synchronize OpenAPI:** Update `openapi.yml` whenever REST endpoints are added or changed.
9. **Rule 9 — Practice Proactive Validation:** Run typecheck, lint, and tests before completing work.

---

## 30. Integration Checklist

- [ ] Target application inspected and framework identified.
- [ ] Required SMS provider packages installed.
- [ ] Environment variables configured in `.env.example`.
- [ ] `SmsProviderRegistry` initialized and providers registered.
- [ ] `SmsService` instantiated.
- [ ] OTP / Pattern sending endpoints implemented.
- [ ] Single SMS endpoints implemented where required.
- [ ] Error handling implemented with `SmsPlatformError` hierarchy.
- [ ] OpenAPI spec (`openapi.yml`) updated.
- [ ] Unit tests created using `MockSmsProvider`.
- [ ] Typecheck passed.
- [ ] Lint passed.
- [ ] Tests passed.

---

## 31. Final Validation Status

All claims and examples in this document have been audited against actual source code implementations and verified using TypeScript typechecking and automated test suites.

```text
SMS AI CONTRACT COMPLETE
```
