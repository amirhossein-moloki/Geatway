import { SmsProviderRegistry } from '../registry/sms-provider.registry.js';
import { SmsCapability } from '../domain/capabilities/sms-capability.enum.js';
import { SmsMessage } from '../domain/sms/sms-message.entity.js';
import { SmsStatus } from '../domain/sms/sms-status.enum.js';
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
  SendSmsResponse,
  SmsWebhookRequest,
} from '../contracts/sms-provider.interface.js';
import { SmsValidationError, UnsupportedSmsCapabilityError } from '../errors/index.js';

export class SmsService {
  constructor(private readonly providerRegistry: SmsProviderRegistry) {}

  public async sendSingle(
    message: SmsMessage,
    options?: Record<string, unknown>,
  ): Promise<{ message: SmsMessage; response: SendSmsResponse }> {
    const providerId = message.provider;
    if (!providerId) {
      throw new SmsValidationError('Provider must be specified on SMS message entity');
    }

    const provider = this.providerRegistry.getActiveProvider(providerId, SmsCapability.SEND_SINGLE);

    const capableProvider = provider as unknown as CanSendSingleSms;
    if (typeof capableProvider.sendSingle !== 'function') {
      throw new UnsupportedSmsCapabilityError(provider.id, SmsCapability.SEND_SINGLE);
    }

    const response = await capableProvider.sendSingle({
      message,
      options,
    });

    if (response.success) {
      message.transitionTo(response.status || SmsStatus.SENT);
    } else {
      message.transitionTo(SmsStatus.FAILED);
    }

    return { message, response };
  }

  public async sendBulk(
    providerId: string,
    request: SendBulkSmsRequest,
  ): Promise<SendBulkSmsResponse> {
    const provider = this.providerRegistry.getActiveProvider(providerId, SmsCapability.SEND_BULK);

    const capableProvider = provider as unknown as CanSendBulkSms;
    if (typeof capableProvider.sendBulk !== 'function') {
      throw new UnsupportedSmsCapabilityError(provider.id, SmsCapability.SEND_BULK);
    }

    return capableProvider.sendBulk(request);
  }

  public async sendLikeToLike(
    providerId: string,
    request: SendLikeToLikeSmsRequest,
  ): Promise<SendLikeToLikeSmsResponse> {
    const provider = this.providerRegistry.getActiveProvider(
      providerId,
      SmsCapability.SEND_LIKE_TO_LIKE,
    );

    const capableProvider = provider as unknown as CanSendLikeToLikeSms;
    if (typeof capableProvider.sendLikeToLike !== 'function') {
      throw new UnsupportedSmsCapabilityError(provider.id, SmsCapability.SEND_LIKE_TO_LIKE);
    }

    return capableProvider.sendLikeToLike(request);
  }

  public async sendPattern(
    providerId: string,
    request: SendPatternSmsRequest,
  ): Promise<SendPatternSmsResponse> {
    const provider = this.providerRegistry.getActiveProvider(
      providerId,
      SmsCapability.SEND_PATTERN,
    );

    const capableProvider = provider as unknown as CanSendPatternSms;
    if (typeof capableProvider.sendPattern !== 'function') {
      throw new UnsupportedSmsCapabilityError(provider.id, SmsCapability.SEND_PATTERN);
    }

    return capableProvider.sendPattern(request);
  }

  public async getDeliveryStatus(
    providerId: string,
    request: GetDeliveryStatusRequest,
  ): Promise<GetDeliveryStatusResponse> {
    const provider = this.providerRegistry.getActiveProvider(
      providerId,
      SmsCapability.GET_DELIVERY,
    );

    const capableProvider = provider as unknown as CanGetDeliveryStatus;
    if (typeof capableProvider.getDeliveryStatus !== 'function') {
      throw new UnsupportedSmsCapabilityError(provider.id, SmsCapability.GET_DELIVERY);
    }

    return capableProvider.getDeliveryStatus(request);
  }

  public async getBalance(
    providerId: string,
    request?: GetBalanceRequest,
  ): Promise<GetBalanceResponse> {
    const provider = this.providerRegistry.getActiveProvider(providerId, SmsCapability.GET_BALANCE);

    const capableProvider = provider as unknown as CanGetBalance;
    if (typeof capableProvider.getBalance !== 'function') {
      throw new UnsupportedSmsCapabilityError(provider.id, SmsCapability.GET_BALANCE);
    }

    return capableProvider.getBalance(request);
  }

  public async getLines(providerId: string, request?: GetLinesRequest): Promise<GetLinesResponse> {
    const provider = this.providerRegistry.getActiveProvider(providerId, SmsCapability.GET_LINES);

    const capableProvider = provider as unknown as CanGetLines;
    if (typeof capableProvider.getLines !== 'function') {
      throw new UnsupportedSmsCapabilityError(provider.id, SmsCapability.GET_LINES);
    }

    return capableProvider.getLines(request);
  }

  public async receiveMessages(
    providerId: string,
    request?: ReceiveMessagesRequest,
  ): Promise<ReceiveMessagesResponse> {
    const provider = this.providerRegistry.getActiveProvider(
      providerId,
      SmsCapability.RECEIVE_MESSAGES,
    );

    const capableProvider = provider as unknown as CanReceiveMessages;
    if (typeof capableProvider.receiveMessages !== 'function') {
      throw new UnsupportedSmsCapabilityError(provider.id, SmsCapability.RECEIVE_MESSAGES);
    }

    return capableProvider.receiveMessages(request);
  }

  public async cancelScheduled(
    providerId: string,
    request: CancelScheduledSmsRequest,
  ): Promise<CancelScheduledSmsResponse> {
    const provider = this.providerRegistry.getActiveProvider(
      providerId,
      SmsCapability.CANCEL_SCHEDULED,
    );

    const capableProvider = provider as unknown as CanCancelScheduledSms;
    if (typeof capableProvider.cancelScheduled !== 'function') {
      throw new UnsupportedSmsCapabilityError(provider.id, SmsCapability.CANCEL_SCHEDULED);
    }

    return capableProvider.cancelScheduled(request);
  }

  public async parseWebhook(
    providerId: string,
    request: SmsWebhookRequest,
  ): Promise<ParsedSmsWebhookResult> {
    const provider = this.providerRegistry.getActiveProvider(providerId, SmsCapability.WEBHOOK);

    const capableProvider = provider as unknown as CanHandleSmsWebhook;
    if (typeof capableProvider.parseWebhook !== 'function') {
      throw new UnsupportedSmsCapabilityError(provider.id, SmsCapability.WEBHOOK);
    }

    return capableProvider.parseWebhook(request);
  }
}
