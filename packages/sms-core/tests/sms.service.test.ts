import { describe, expect, it } from 'vitest';
import {
  CanCancelScheduledSms,
  CanGetBalance,
  CanGetDeliveryStatus,
  CanGetLines,
  CanHandleSmsWebhook,
  CanReceiveMessages,
  CanSendBulkSms,
  CanSendLikeToLikeSms,
  CanSendPatternSms,
  CanSendSingleSms,
  CancelScheduledSmsRequest,
  CancelScheduledSmsResponse,
  GetBalanceRequest,
  GetBalanceResponse,
  GetDeliveryStatusRequest,
  GetDeliveryStatusResponse,
  GetLinesRequest,
  GetLinesResponse,
  ParsedSmsWebhookResult,
  ReceiveMessagesRequest,
  ReceiveMessagesResponse,
  SendBulkSmsRequest,
  SendBulkSmsResponse,
  SendLikeToLikeSmsRequest,
  SendLikeToLikeSmsResponse,
  SendPatternSmsRequest,
  SendPatternSmsResponse,
  SendSmsRequest,
  SendSmsResponse,
  SmsProvider,
  SmsWebhookRequest,
} from '../src/core/contracts/sms-provider.interface.js';
import { SmsCapability } from '../src/core/domain/capabilities/sms-capability.enum.js';
import { SmsMessage } from '../src/core/domain/sms/sms-message.entity.js';
import { SmsStatus } from '../src/core/domain/sms/sms-status.enum.js';
import { SmsProviderRegistry } from '../src/core/registry/sms-provider.registry.js';
import { SmsService } from '../src/core/services/sms.service.js';
import { SmsValidationError, UnsupportedSmsCapabilityError } from '../src/core/errors/index.js';

class FullMockSmsProvider
  implements
    SmsProvider,
    CanSendSingleSms,
    CanSendBulkSms,
    CanSendLikeToLikeSms,
    CanSendPatternSms,
    CanGetDeliveryStatus,
    CanGetBalance,
    CanGetLines,
    CanReceiveMessages,
    CanCancelScheduledSms,
    CanHandleSmsWebhook
{
  public readonly id = 'full-mock';
  public readonly displayName = 'Full Mock Provider';
  public readonly isEnabled = true;
  public readonly capabilities = new Set<SmsCapability>([
    SmsCapability.SEND_SINGLE,
    SmsCapability.SEND_BULK,
    SmsCapability.SEND_LIKE_TO_LIKE,
    SmsCapability.SEND_PATTERN,
    SmsCapability.GET_DELIVERY,
    SmsCapability.GET_BALANCE,
    SmsCapability.GET_LINES,
    SmsCapability.RECEIVE_MESSAGES,
    SmsCapability.CANCEL_SCHEDULED,
    SmsCapability.WEBHOOK,
  ]);

  supportsCapability(capability: SmsCapability): boolean {
    return this.capabilities.has(capability);
  }

  async sendSingle(_request: SendSmsRequest): Promise<SendSmsResponse> {
    return {
      success: true,
      messageId: 1001,
      cost: 10,
      status: SmsStatus.SENT,
    };
  }

  async sendBulk(_request: SendBulkSmsRequest): Promise<SendBulkSmsResponse> {
    return {
      success: true,
      packId: 'pack_1',
      messageIds: [1001, 1002],
      cost: 20,
      status: SmsStatus.SENT,
    };
  }

  async sendLikeToLike(_request: SendLikeToLikeSmsRequest): Promise<SendLikeToLikeSmsResponse> {
    return {
      success: true,
      packId: 'pack_2',
      messageIds: [2001, 2002],
      cost: 25,
      status: SmsStatus.SENT,
    };
  }

  async sendPattern(_request: SendPatternSmsRequest): Promise<SendPatternSmsResponse> {
    return {
      success: true,
      messageId: 3001,
      cost: 15,
      status: SmsStatus.SENT,
    };
  }

  async getDeliveryStatus(_request: GetDeliveryStatusRequest): Promise<GetDeliveryStatusResponse> {
    return {
      success: true,
      statuses: [
        {
          messageId: 1001,
          deliveryStatus: SmsStatus.DELIVERED,
        },
      ],
    };
  }

  async getBalance(_request?: GetBalanceRequest): Promise<GetBalanceResponse> {
    return {
      success: true,
      balance: 150000,
    };
  }

  async getLines(_request?: GetLinesRequest): Promise<GetLinesResponse> {
    return {
      success: true,
      lines: [{ lineNumber: '30000000' }],
    };
  }

  async receiveMessages(_request?: ReceiveMessagesRequest): Promise<ReceiveMessagesResponse> {
    return {
      success: true,
      messages: [
        {
          messageId: 5001,
          lineNumber: '30000000',
          mobile: '09123456789',
          messageText: 'Hello back',
          receiveDateTime: new Date(),
        },
      ],
    };
  }

  async cancelScheduled(_request: CancelScheduledSmsRequest): Promise<CancelScheduledSmsResponse> {
    return {
      success: true,
      returnedCreditCount: 10,
      smsCount: 2,
    };
  }

  async parseWebhook(_request: SmsWebhookRequest): Promise<ParsedSmsWebhookResult> {
    return {
      eventType: 'DELIVERY_REPORT',
      messageId: 1001,
      status: SmsStatus.DELIVERED,
      rawData: {},
    };
  }
}

describe('SmsService Orchestrator', () => {
  it('should send single SMS and transition message status to SENT', async () => {
    const registry = new SmsProviderRegistry();
    const provider = new FullMockSmsProvider();
    registry.register(provider);

    const service = new SmsService(registry);
    const msg = new SmsMessage({
      provider: 'full-mock',
      recipients: ['09123456789'],
      messageTexts: ['Hello Service'],
    });

    const result = await service.sendSingle(msg);
    expect(result.response.success).toBe(true);
    expect(result.message.status).toBe(SmsStatus.SENT);
  });

  it('should throw SmsValidationError if message has no provider specified', async () => {
    const registry = new SmsProviderRegistry();
    const service = new SmsService(registry);
    const msg = new SmsMessage({
      recipients: ['09123456789'],
      messageTexts: ['No Provider'],
    });

    await expect(service.sendSingle(msg)).rejects.toThrow(SmsValidationError);
  });

  it('should send bulk SMS', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new FullMockSmsProvider());
    const service = new SmsService(registry);

    const response = await service.sendBulk('full-mock', {
      messageText: 'Bulk Hello',
      mobiles: ['09123456789', '09129999999'],
    });

    expect(response.success).toBe(true);
    expect(response.packId).toBe('pack_1');
  });

  it('should send like-to-like SMS', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new FullMockSmsProvider());
    const service = new SmsService(registry);

    const response = await service.sendLikeToLike('full-mock', {
      messageTexts: ['Text 1', 'Text 2'],
      mobiles: ['09123456789', '09129999999'],
    });

    expect(response.success).toBe(true);
    expect(response.packId).toBe('pack_2');
  });

  it('should send pattern SMS (OTP)', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new FullMockSmsProvider());
    const service = new SmsService(registry);

    const response = await service.sendPattern('full-mock', {
      mobile: '09123456789',
      templateId: 100,
      parameters: [{ name: 'CODE', value: '1234' }],
    });

    expect(response.success).toBe(true);
    expect(response.messageId).toBe(3001);
  });

  it('should fetch delivery status', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new FullMockSmsProvider());
    const service = new SmsService(registry);

    const response = await service.getDeliveryStatus('full-mock', { messageId: 1001 });
    expect(response.success).toBe(true);
    expect(response.statuses[0]?.deliveryStatus).toBe(SmsStatus.DELIVERED);
  });

  it('should fetch balance', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new FullMockSmsProvider());
    const service = new SmsService(registry);

    const response = await service.getBalance('full-mock');
    expect(response.success).toBe(true);
    expect(response.balance).toBe(150000);
  });

  it('should fetch lines', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new FullMockSmsProvider());
    const service = new SmsService(registry);

    const response = await service.getLines('full-mock');
    expect(response.success).toBe(true);
    expect(response.lines[0]?.lineNumber).toBe('30000000');
  });

  it('should receive messages', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new FullMockSmsProvider());
    const service = new SmsService(registry);

    const response = await service.receiveMessages('full-mock');
    expect(response.success).toBe(true);
    expect(response.messages).toHaveLength(1);
  });

  it('should cancel scheduled send', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new FullMockSmsProvider());
    const service = new SmsService(registry);

    const response = await service.cancelScheduled('full-mock', { packId: 'pack_1' });
    expect(response.success).toBe(true);
    expect(response.returnedCreditCount).toBe(10);
  });

  it('should parse webhook', async () => {
    const registry = new SmsProviderRegistry();
    registry.register(new FullMockSmsProvider());
    const service = new SmsService(registry);

    const result = await service.parseWebhook('full-mock', {
      query: {},
      body: {},
      headers: {},
    });

    expect(result.eventType).toBe('DELIVERY_REPORT');
    expect(result.status).toBe(SmsStatus.DELIVERED);
  });

  it('should throw UnsupportedSmsCapabilityError when method is missing on provider object', async () => {
    const registry = new SmsProviderRegistry();
    const incompleteProvider = {
      id: 'incomplete',
      displayName: 'Incomplete Provider',
      isEnabled: true,
      capabilities: new Set([SmsCapability.SEND_SINGLE]),
      supportsCapability: (c: SmsCapability) => c === SmsCapability.SEND_SINGLE,
    };
    registry.register(incompleteProvider as unknown as SmsProvider);

    const service = new SmsService(registry);
    const msg = new SmsMessage({
      provider: 'incomplete',
      recipients: ['09123456789'],
      messageTexts: ['Test'],
    });

    await expect(service.sendSingle(msg)).rejects.toThrow(UnsupportedSmsCapabilityError);
  });
});
