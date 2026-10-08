import {
  CanCancelScheduledSms,
  CanGetBalance,
  CanGetDeliveryStatus,
  CanGetLines,
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
  PatternParameter,
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
  SmsCapability,
  SmsProvider,
  SmsValidationError,
} from '@amirhossein-moloki/sms-core';
import { HttpTransport, SmsirClient } from '../client/smsir-client.js';
import { SmsirConfig, validateSmsirConfig } from '../config/smsir-config.interface.js';
import { SmsirErrorMapper } from '../errors/smsir-error-mapper.js';
import { SmsirResponseMapper } from '../mapper/smsir-response-mapper.js';

export class SmsirProvider
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
    CanCancelScheduledSms
{
  public readonly id: string;
  public readonly displayName: string = 'SMS.ir';
  public readonly isEnabled: boolean;
  public readonly capabilities: ReadonlySet<SmsCapability> = new Set<SmsCapability>([
    SmsCapability.SEND_SINGLE,
    SmsCapability.SEND_BULK,
    SmsCapability.SEND_LIKE_TO_LIKE,
    SmsCapability.SEND_PATTERN,
    SmsCapability.GET_DELIVERY,
    SmsCapability.GET_BALANCE,
    SmsCapability.GET_LINES,
    SmsCapability.RECEIVE_MESSAGES,
    SmsCapability.CANCEL_SCHEDULED,
  ]);

  private readonly config: SmsirConfig;
  private readonly client: SmsirClient;

  constructor(config: SmsirConfig, transport?: HttpTransport) {
    validateSmsirConfig(config);
    this.config = config;
    this.id = config.providerId || 'smsir';
    this.isEnabled = config.isEnabled ?? true;
    this.client = new SmsirClient(config, transport);
  }

  public supportsCapability(capability: SmsCapability): boolean {
    return this.capabilities.has(capability);
  }

  public async sendSingle(request: SendSmsRequest): Promise<SendSmsResponse> {
    const { message, options } = request;

    const mobiles = message.recipients;
    const lineNumber = message.line || this.config.lineNumber || (options?.lineNumber as string);
    const messageText = message.messageTexts[0] || '';
    const sendDateTime = message.sendDateTime
      ? typeof message.sendDateTime === 'number'
        ? message.sendDateTime
        : message.sendDateTime.getTime() / 1000
      : null;

    if (!lineNumber) {
      throw new SmsValidationError('Line number is required for SMS.ir sendBulk/single');
    }

    try {
      const response = await this.client.sendBulk({
        lineNumber,
        messageText,
        mobiles,
        sendDateTime,
      });

      if (response.status !== 1) {
        throw SmsirErrorMapper.mapStatusToError(
          response.status,
          response.message,
          this.id,
          'SMS.ir single send failed',
        );
      }

      return SmsirResponseMapper.mapSendResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw SmsirErrorMapper.mapStatusToError(
        -1,
        (err as Error).message || 'Single SMS execution failed',
        this.id,
      );
    }
  }

  public async sendBulk(request: SendBulkSmsRequest): Promise<SendBulkSmsResponse> {
    const { lineNumber, messageText, mobiles, sendDateTime } = request;
    const line = lineNumber || this.config.lineNumber;

    if (!line) {
      throw new SmsValidationError('Line number is required for SMS.ir bulk send');
    }

    const epochSendTime = sendDateTime
      ? typeof sendDateTime === 'number'
        ? sendDateTime
        : sendDateTime.getTime() / 1000
      : null;

    try {
      const response = await this.client.sendBulk({
        lineNumber: line,
        messageText,
        mobiles,
        sendDateTime: epochSendTime,
      });

      if (response.status !== 1) {
        throw SmsirErrorMapper.mapStatusToError(
          response.status,
          response.message,
          this.id,
          'SMS.ir bulk send failed',
        );
      }

      return SmsirResponseMapper.mapBulkResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw SmsirErrorMapper.mapStatusToError(
        -1,
        (err as Error).message || 'Bulk SMS execution failed',
        this.id,
      );
    }
  }

  public async sendLikeToLike(
    request: SendLikeToLikeSmsRequest,
  ): Promise<SendLikeToLikeSmsResponse> {
    const { lineNumber, messageTexts, mobiles, sendDateTime } = request;
    const line = lineNumber || this.config.lineNumber;

    if (!line) {
      throw new SmsValidationError('Line number is required for SMS.ir likeToLike send');
    }

    const epochSendTime = sendDateTime
      ? typeof sendDateTime === 'number'
        ? sendDateTime
        : sendDateTime.getTime() / 1000
      : null;

    try {
      const response = await this.client.sendLikeToLike({
        lineNumber: line,
        messageTexts,
        mobiles,
        sendDateTime: epochSendTime,
      });

      if (response.status !== 1) {
        throw SmsirErrorMapper.mapStatusToError(
          response.status,
          response.message,
          this.id,
          'SMS.ir likeToLike send failed',
        );
      }

      return SmsirResponseMapper.mapLikeToLikeResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw SmsirErrorMapper.mapStatusToError(
        -1,
        (err as Error).message || 'LikeToLike SMS execution failed',
        this.id,
      );
    }
  }

  public async sendPattern(request: SendPatternSmsRequest): Promise<SendPatternSmsResponse> {
    const { mobile, templateId, parameters } = request;

    try {
      const response = await this.client.verify({
        mobile,
        templateId,
        parameters: parameters.map((p: PatternParameter) => ({ name: p.name, value: p.value })),
      });

      if (response.status !== 1) {
        throw SmsirErrorMapper.mapStatusToError(
          response.status,
          response.message,
          this.id,
          'SMS.ir verify/pattern send failed',
        );
      }

      return SmsirResponseMapper.mapPatternResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw SmsirErrorMapper.mapStatusToError(
        -1,
        (err as Error).message || 'Pattern SMS execution failed',
        this.id,
      );
    }
  }

  public async getDeliveryStatus(
    request: GetDeliveryStatusRequest,
  ): Promise<GetDeliveryStatusResponse> {
    try {
      if (request.messageId) {
        const response = await this.client.getMessageReport(request.messageId);
        return SmsirResponseMapper.mapDeliveryResponse(response);
      } else if (request.packId) {
        const response = await this.client.getPackReport(
          request.packId,
          request.pageNumber || 1,
          request.pageSize || 100,
        );
        return SmsirResponseMapper.mapDeliveryResponse(response);
      } else {
        const response = await this.client.getLiveReport(
          request.pageNumber || 1,
          request.pageSize || 100,
        );
        return SmsirResponseMapper.mapDeliveryResponse(response);
      }
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw SmsirErrorMapper.mapStatusToError(
        -1,
        (err as Error).message || 'Get delivery status failed',
        this.id,
      );
    }
  }

  public async getBalance(_request?: GetBalanceRequest): Promise<GetBalanceResponse> {
    try {
      const response = await this.client.getCredit();

      if (response.status !== 1) {
        throw SmsirErrorMapper.mapStatusToError(
          response.status,
          response.message,
          this.id,
          'SMS.ir getCredit failed',
        );
      }

      return SmsirResponseMapper.mapBalanceResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw SmsirErrorMapper.mapStatusToError(
        -1,
        (err as Error).message || 'Get balance failed',
        this.id,
      );
    }
  }

  public async getLines(_request?: GetLinesRequest): Promise<GetLinesResponse> {
    try {
      const response = await this.client.getLines();

      if (response.status !== 1) {
        throw SmsirErrorMapper.mapStatusToError(
          response.status,
          response.message,
          this.id,
          'SMS.ir getLines failed',
        );
      }

      return SmsirResponseMapper.mapLinesResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw SmsirErrorMapper.mapStatusToError(
        -1,
        (err as Error).message || 'Get lines failed',
        this.id,
      );
    }
  }

  public async receiveMessages(
    request?: ReceiveMessagesRequest,
  ): Promise<ReceiveMessagesResponse> {
    const count = request?.count || request?.pageSize || 100;

    try {
      const response = await this.client.getLatestReceived(count);

      if (response.status !== 1) {
        throw SmsirErrorMapper.mapStatusToError(
          response.status,
          response.message,
          this.id,
          'SMS.ir receiveMessages failed',
        );
      }

      return SmsirResponseMapper.mapReceiveMessagesResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw SmsirErrorMapper.mapStatusToError(
        -1,
        (err as Error).message || 'Receive messages failed',
        this.id,
      );
    }
  }

  public async cancelScheduled(
    request: CancelScheduledSmsRequest,
  ): Promise<CancelScheduledSmsResponse> {
    const packId = request.packId;

    if (!packId) {
      throw new SmsValidationError('packId is required to cancel scheduled SMS');
    }

    try {
      const response = await this.client.cancelScheduled(packId);

      if (response.status !== 1) {
        throw SmsirErrorMapper.mapStatusToError(
          response.status,
          response.message,
          this.id,
          'SMS.ir cancelScheduled failed',
        );
      }

      return SmsirResponseMapper.mapCancelScheduledResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw SmsirErrorMapper.mapStatusToError(
        -1,
        (err as Error).message || 'Cancel scheduled SMS failed',
        this.id,
      );
    }
  }
}
