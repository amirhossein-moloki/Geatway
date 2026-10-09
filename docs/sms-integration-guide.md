# SMS Package Ecosystem — Integration Guide

Welcome to the SMS Package Ecosystem integration guide. This document provides a comprehensive, end-to-end reference for integrating our modular, capability-driven SMS panel ecosystem into your Node.js / TypeScript backend application.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Package Installation](#3-package-installation)
4. [Package Selection](#4-package-selection)
5. [Configuration](#5-configuration)
6. [Environment Variables](#6-environment-variables)
7. [Provider Registration](#7-provider-registration)
8. [Sending Single SMS](#8-sending-single-sms)
9. [Sending Bulk SMS](#9-sending-bulk-sms)
10. [Sending Like-to-Like SMS](#10-sending-like-to-like-sms)
11. [Sending Pattern (OTP) SMS](#11-sending-pattern-otp-sms)
12. [Checking Delivery Status](#12-checking-delivery-status)
13. [Checking Account Balance](#13-checking-account-balance)
14. [Fetching Available Lines](#14-fetching-available-lines)
15. [Receiving Messages](#15-receiving-messages)
16. [Canceling Scheduled Messages](#16-canceling-scheduled-messages)
17. [Webhook Integration](#17-webhook-integration)
18. [Error Handling](#18-error-handling)
19. [Testing Strategy](#19-testing-strategy)
20. [REST API Integration](#20-rest-api-integration)
21. [OpenAPI Integration](#21-openapi-integration)
22. [Security & Best Practices](#22-security--best-practices)
23. [Complete Integration Example](#23-complete-integration-example)

---

## 1. Overview

The SMS Package Ecosystem is a modular, provider-agnostic collection of TypeScript libraries designed to simplify SMS communication across various Iranian SMS gateway panels (e.g. Melipayamak, SMS.ir).

Key principles:

- **Provider Agnostic Core**: Core models, interfaces, and orchestrator logic reside in `@amirhossein-moloki/sms-core`.
- **Capability-Driven Design**: Operations are safely gated by capability contracts (`CanSendSingleSms`, `CanSendBulkSms`, `CanSendPatternSms`, `CanGetBalance`, etc.).
- **Decoupled Architecture**: SMS packages are headless libraries. HTTP routes, REST endpoints, and controllers are managed by your application.

---

## 2. Architecture

```text
Target Application (Express / Fastify / NestJS / Custom Controllers)
        │
        ▼
SmsService (@amirhossein-moloki/sms-core)
        │
        ▼
SmsProviderRegistry (@amirhossein-moloki/sms-core)
        ├──► MelipayamakProvider (@amirhossein-moloki/sms-melipayamak)
        └──► SmsIrProvider (@amirhossein-moloki/sms-smsir)
```

---

## 3. Package Installation

Install `@amirhossein-moloki/sms-core` alongside the provider packages your application requires:

```bash
# Core package
pnpm add @amirhossein-moloki/sms-core

# Install desired SMS provider packages
pnpm add @amirhossein-moloki/sms-melipayamak @amirhossein-moloki/sms-smsir
```

---

## 4. Package Selection

| Package Name                          |   Required   | Provider / Capability                                                  |
| :------------------------------------ | :----------: | :--------------------------------------------------------------------- |
| `@amirhossein-moloki/sms-core`        | **Required** | Domain entities, provider registry, orchestrator service, error types. |
| `@amirhossein-moloki/sms-melipayamak` |   Optional   | Melipayamak SMS Panel provider integration.                            |
| `@amirhossein-moloki/sms-smsir`       |   Optional   | SMS.ir Panel V2 provider integration.                                  |

---

## 5. Configuration

Each provider package exports a configuration interface and validation function.

### Melipayamak Configuration (`MelipayamakConfig`)

```ts
import { MelipayamakConfig } from '@amirhossein-moloki/sms-melipayamak';

const config: MelipayamakConfig = {
  providerId: 'melipayamak',
  username: process.env.MELIPAYAMAK_USERNAME!,
  password: process.env.MELIPAYAMAK_PASSWORD!,
  defaultLineNumber: process.env.MELIPAYAMAK_LINE_NUMBER,
};
```

### SMS.ir Configuration (`SmsIrConfig`)

```ts
import { SmsIrConfig } from '@amirhossein-moloki/sms-smsir';

const config: SmsIrConfig = {
  providerId: 'smsir',
  apiKey: process.env.SMSIR_API_KEY!,
  defaultLineNumber: process.env.SMSIR_LINE_NUMBER,
};
```

---

## 6. Environment Variables

Store provider credentials in environment variables (`.env`):

```env
# Melipayamak
MELIPAYAMAK_USERNAME=your_username
MELIPAYAMAK_PASSWORD=your_password
MELIPAYAMAK_LINE_NUMBER=5000...

# SMS.ir
SMSIR_API_KEY=your_smsir_api_key
SMSIR_LINE_NUMBER=3000...
```

---

## 7. Provider Registration

Register initialized provider instances into `SmsProviderRegistry` and pass the registry to `SmsService`:

```ts
import { SmsProviderRegistry, SmsService } from '@amirhossein-moloki/sms-core';
import { MelipayamakProvider } from '@amirhossein-moloki/sms-melipayamak';
import { SmsIrProvider } from '@amirhossein-moloki/sms-smsir';

export function setupSmsService(): SmsService {
  const registry = new SmsProviderRegistry();

  if (process.env.MELIPAYAMAK_USERNAME) {
    const melipayamak = new MelipayamakProvider({
      username: process.env.MELIPAYAMAK_USERNAME,
      password: process.env.MELIPAYAMAK_PASSWORD!,
      defaultLineNumber: process.env.MELIPAYAMAK_LINE_NUMBER,
    });
    registry.register(melipayamak);
  }

  if (process.env.SMSIR_API_KEY) {
    const smsir = new SmsIrProvider({
      apiKey: process.env.SMSIR_API_KEY,
      defaultLineNumber: process.env.SMSIR_LINE_NUMBER,
    });
    registry.register(smsir);
  }

  return new SmsService(registry);
}
```

---

## 8. Sending Single SMS

Create an `SmsMessage` instance and call `smsService.sendSingle`:

```ts
import { SmsMessage } from '@amirhossein-moloki/sms-core';

const message = new SmsMessage({
  provider: 'smsir',
  recipients: ['09123456789'],
  messageTexts: ['Welcome to our platform!'],
});

const result = await smsService.sendSingle(message);
console.log('Message ID:', result.response.messageId);
console.log('Status:', result.message.status);
```

---

## 9. Sending Bulk SMS

Send a single text message to multiple recipients:

```ts
const response = await smsService.sendBulk('melipayamak', {
  messageText: 'Special discount offer on all products!',
  mobiles: ['09123456789', '09129999999'],
});

console.log('Pack ID:', response.packId);
console.log('Message IDs:', response.messageIds);
```

---

## 10. Sending Like-to-Like SMS

Send individual custom messages to corresponding recipient numbers:

```ts
const response = await smsService.sendLikeToLike('smsir', {
  messageTexts: ['Hello Ali, code: 101', 'Hello Reza, code: 102'],
  mobiles: ['09121111111', '09122222222'],
});

console.log('Pack ID:', response.packId);
```

---

## 11. Sending Pattern (OTP) SMS

Send templated operational SMS (e.g., OTP codes) using template parameters:

```ts
const response = await smsService.sendPattern('smsir', {
  mobile: '09123456789',
  templateId: 100000,
  parameters: [{ name: 'CODE', value: '849201' }],
});

console.log('OTP Message ID:', response.messageId);
```

---

## 12. Checking Delivery Status

Retrieve the delivery report for sent messages:

```ts
const delivery = await smsService.getDeliveryStatus('smsir', {
  messageId: 12345678,
});

console.log('Status:', delivery.statuses[0]?.deliveryStatus);
```

---

## 13. Checking Account Balance

Query remaining credit balance:

```ts
const balanceInfo = await smsService.getBalance('melipayamak');
console.log('Remaining balance:', balanceInfo.balance);
```

---

## 14. Fetching Available Lines

List configured sender lines for a provider:

```ts
const linesInfo = await smsService.getLines('smsir');
console.log('Lines:', linesInfo.lines);
```

---

## 15. Receiving Messages

Retrieve incoming SMS messages sent to your line:

```ts
const incoming = await smsService.receiveMessages('melipayamak', {
  type: 'latest',
  count: 10,
});

console.log('Received messages count:', incoming.messages.length);
```

---

## 16. Canceling Scheduled Messages

Cancel a scheduled bulk message before dispatch:

```ts
const cancelResult = await smsService.cancelScheduled('melipayamak', {
  packId: 'pack_98765',
});

console.log('Returned credit:', cancelResult.returnedCreditCount);
```

---

## 17. Webhook Integration

Parse incoming status report webhooks from providers:

```ts
app.post('/api/v1/sms/webhooks/:provider', async (req, res) => {
  const { provider } = req.params;

  const result = await smsService.parseWebhook(provider, {
    query: req.query as Record<string, unknown>,
    body: req.body as Record<string, unknown>,
    headers: req.headers as Record<string, string>,
  });

  console.log('Webhook Event:', result.eventType);
  console.log('Message ID:', result.messageId);
  console.log('Status:', result.status);

  res.status(200).json({ status: 'ok' });
});
```

---

## 18. Error Handling

All core errors inherit from `SmsPlatformError`:

```ts
import {
  SmsPlatformError,
  SmsValidationError,
  SmsProviderNotFoundError,
  SmsProviderDisabledError,
  UnsupportedSmsCapabilityError,
  SmsProviderError,
} from '@amirhossein-moloki/sms-core';

try {
  await smsService.sendSingle(message);
} catch (err) {
  if (err instanceof SmsValidationError) {
    // Missing required fields (HTTP 400)
  } else if (err instanceof SmsProviderNotFoundError) {
    // Provider ID not registered (HTTP 404)
  } else if (err instanceof UnsupportedSmsCapabilityError) {
    // Capability not supported by provider (HTTP 422)
  } else if (err instanceof SmsProviderError) {
    // External SMS panel provider returned an error (HTTP 502)
    console.error(`Provider error [${err.code}]: ${err.message}`);
  } else if (err instanceof SmsPlatformError) {
    // General SMS platform error
  }
}
```

---

## 19. Testing Strategy

Implement a mock provider conforming to `SmsProvider` for unit testing without live network calls:

```ts
import { SmsProvider, SmsCapability, SmsStatus } from '@amirhossein-moloki/sms-core';

class MockSmsProvider implements SmsProvider {
  readonly id = 'mock-provider';
  readonly displayName = 'Mock Provider';
  readonly isEnabled = true;
  readonly capabilities = new Set([SmsCapability.SEND_SINGLE, SmsCapability.SEND_PATTERN]);

  supportsCapability(cap: SmsCapability) {
    return this.capabilities.has(cap);
  }

  async sendSingle() {
    return { success: true, messageId: 999, status: SmsStatus.SENT };
  }

  async sendPattern() {
    return { success: true, messageId: 888, status: SmsStatus.SENT };
  }
}
```

---

## 20. REST API Integration

In your target project, expose endpoints for your business logic:

- `POST /api/v1/sms/send-otp` — Send OTP verification code via pattern
- `POST /api/v1/sms/send-bulk` — Send marketing bulk SMS
- `GET /api/v1/sms/balance` — Query remaining credit balance
- `POST /api/v1/sms/webhooks/:provider` — Handle delivery report webhooks

---

## 21. OpenAPI Integration

When adding SMS endpoints to your application, document them in your application's `openapi.yml` specification file. Do not expose sensitive credentials (e.g. `apiKey` or `password`) in schemas.

---

## 22. Security & Best Practices

1. Never commit API keys, usernames, or passwords in source files.
2. Rate limit public OTP endpoints to prevent SMS flooding attacks.
3. Redact recipient phone numbers and security codes in log output.

---

## 23. Complete Integration Example

```ts
import { SmsProviderRegistry, SmsService, SmsMessage } from '@amirhossein-moloki/sms-core';
import { SmsIrProvider } from '@amirhossein-moloki/sms-smsir';

async function main() {
  const registry = new SmsProviderRegistry();
  const smsir = new SmsIrProvider({
    apiKey: 'your_api_key',
    defaultLineNumber: '30000000',
  });
  registry.register(smsir);

  const smsService = new SmsService(registry);

  // Send Pattern (OTP)
  const otpResponse = await smsService.sendPattern('smsir', {
    mobile: '09123456789',
    templateId: 100000,
    parameters: [{ name: 'CODE', value: '123456' }],
  });

  console.log('OTP Sent successfully:', otpResponse.success);
}

main().catch(console.error);
```
