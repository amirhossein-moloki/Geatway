import { describe, expect, it } from 'vitest';
import {
  SmsProvider,
  SmsCapability,
  SmsStatus,
  SmsProviderRegistry,
  SmsValidationError,
  SmsProviderNotFoundError,
  CanSendSingleSms,
  CanSendPatternSms,
  CanGetBalance,
  SendSmsRequest,
  SendSmsResponse,
  SendPatternSmsRequest,
  SendPatternSmsResponse,
  GetBalanceResponse,
} from '@amirhossein-moloki/sms-core';
import { createSmsApplication } from '../src/index.js';

class IntegrationMockSmsProvider
  implements SmsProvider, CanSendSingleSms, CanSendPatternSms, CanGetBalance
{
  readonly id = 'mock-provider';
  readonly displayName = 'Mock Integration Provider';
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
      messageId: 'mock_msg_001',
      status: SmsStatus.SENT,
    };
  }

  async sendPattern(request: SendPatternSmsRequest): Promise<SendPatternSmsResponse> {
    return {
      success: true,
      messageId: 'mock_pattern_002',
      status: SmsStatus.SENT,
    };
  }

  async getBalance(): Promise<GetBalanceResponse> {
    return {
      success: true,
      balance: 250000,
    };
  }
}

describe('SMS Integration Example Application', () => {
  it('sends single SMS successfully', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new IntegrationMockSmsProvider());

    const { controller } = createSmsApplication(registry);

    const res = await controller.sendSingleSms({
      provider: 'mock-provider',
      recipient: '09123456789',
      text: 'Hello World',
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe('mock_msg_001');
    expect(res.status).toBe(SmsStatus.SENT);
  });

  it('sends OTP SMS via pattern successfully', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new IntegrationMockSmsProvider());

    const { controller } = createSmsApplication(registry);

    const res = await controller.sendOtpSms({
      provider: 'mock-provider',
      mobile: '09123456789',
      templateId: 100,
      code: '123456',
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe('mock_pattern_002');
  });

  it('queries account balance successfully', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new IntegrationMockSmsProvider());

    const { controller } = createSmsApplication(registry);

    const res = await controller.getBalance('mock-provider');
    expect(res.provider).toBe('mock-provider');
    expect(res.balance).toBe(250000);
  });

  it('throws SmsValidationError when input fields are missing', async () => {
    const registry = new SmsProviderRegistry();
    const { controller } = createSmsApplication(registry);

    await expect(
      controller.sendSingleSms({
        provider: '',
        recipient: '09123456789',
        text: 'Hello',
      }),
    ).rejects.toThrow(SmsValidationError);
  });

  it('throws SmsProviderNotFoundError for unregistered provider', async () => {
    const registry = new SmsProviderRegistry();
    const { controller } = createSmsApplication(registry);

    await expect(
      controller.sendSingleSms({
        provider: 'unregistered',
        recipient: '09123456789',
        text: 'Hello',
      }),
    ).rejects.toThrow(SmsProviderNotFoundError);
  });
});
