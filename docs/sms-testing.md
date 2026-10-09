# SMS Ecosystem — Testing Strategy Guide

This guide outlines testing best practices and patterns for applications integrating `@amirhossein-moloki/sms-core` and provider packages (`@amirhossein-moloki/sms-melipayamak`, `@amirhossein-moloki/sms-smsir`).

---

## 1. Unit Testing Strategy

Applications using the SMS ecosystem should write deterministic unit tests that do **not** depend on external SMS gateway networks or active panel subscriptions.

### Testing Approaches:

1. **Mock Provider (`MockSmsProvider`)**: Implement a lightweight in-memory `SmsProvider` class conforming to capabilities required by your application.
2. **Mocking Provider Client/HTTP**: Use Vitest mocks or MSW (Mock Service Worker) to simulate provider HTTP/SOAP client responses.

---

## 2. Implementing a Mock Provider

A custom `MockSmsProvider` allows testing `SmsService` and application controllers with zero network dependencies:

```ts
import {
  SmsProvider,
  SmsCapability,
  SmsStatus,
  CanSendSingleSms,
  CanSendPatternSms,
  CanGetBalance,
  SendSmsRequest,
  SendSmsResponse,
  SendPatternRequest,
  SendPatternResponse,
  GetBalanceResponse,
} from '@amirhossein-moloki/sms-core';

export class MockSmsProvider
  implements SmsProvider, CanSendSingleSms, CanSendPatternSms, CanGetBalance
{
  readonly id = 'mock-provider';
  readonly displayName = 'Mock Provider';
  readonly isEnabled = true;
  readonly capabilities = new Set<SmsCapability>([
    SmsCapability.SEND_SINGLE,
    SmsCapability.SEND_PATTERN,
    SmsCapability.GET_BALANCE,
  ]);

  supportsCapability(capability: SmsCapability): boolean {
    return this.capabilities.has(capability);
  }

  async sendSingle(request: SendSmsRequest): Promise<SendSmsResponse> {
    return {
      success: true,
      messageId: 'msg_mock_101',
      cost: 1,
      status: SmsStatus.SENT,
    };
  }

  async sendPattern(request: SendPatternRequest): Promise<SendPatternResponse> {
    return {
      success: true,
      messageId: 'msg_mock_pattern_202',
      cost: 1,
      status: SmsStatus.SENT,
    };
  }

  async getBalance(): Promise<GetBalanceResponse> {
    return {
      success: true,
      balance: 500000,
    };
  }
}
```

---

## 3. Testing `SmsService` with Mock Provider

```ts
import { describe, expect, it } from 'vitest';
import {
  SmsProviderRegistry,
  SmsService,
  SmsMessage,
  SmsStatus,
} from '@amirhossein-moloki/sms-core';
import { MockSmsProvider } from './mock-sms-provider';

describe('SMS Application Integration', () => {
  it('sends single SMS via mock provider', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new MockSmsProvider());

    const service = new SmsService(registry);
    const message = new SmsMessage({
      provider: 'mock-provider',
      recipients: ['09123456789'],
      messageTexts: ['Test Message'],
    });

    const result = await service.sendSingle(message);
    expect(result.response.success).toBe(true);
    expect(result.message.status).toBe(SmsStatus.SENT);
  });
});
```

---

## 4. Testing Provider Clients Directly

When testing custom provider extensions or client options, mock underlying HTTP clients (e.g., `axios`, `fetch`, or SOAP clients):

```ts
import { describe, expect, it, vi } from 'vitest';
import { SmsIrProvider } from '@amirhossein-moloki/sms-smsir';

describe('SmsIrProvider Unit Tests', () => {
  it('handles provider error codes gracefully', async () => {
    const provider = new SmsIrProvider({ apiKey: 'test_key' });

    // Mock client request failure
    vi.spyOn(provider['client'], 'post').mockRejectedValue({
      response: { status: 401, data: { status: 401, message: 'Unauthorized' } },
    });

    await expect(
      provider.sendPattern({
        mobile: '09123456789',
        templateId: 100,
        parameters: [],
      }),
    ).rejects.toThrow();
  });
});
```

---

## 5. Vitest Configuration Example

In workspace or target application `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'src/**/*.spec.ts'],
  },
});
```

---

## 6. Testing Checklist

- [ ] Unit tests execute with no live network calls or credentials.
- [ ] Edge cases (invalid phone numbers, missing templates, provider errors) are covered.
- [ ] Unsupported capability errors are verified when calling capabilities not present on target providers.
- [ ] Webhook payload parsing is tested with sample provider payloads.
