import {
  CanGetBalance,
  CanGetDeliveryStatus,
  CanGetLines,
  CanReceiveMessages,
  CanSendPatternSms,
  CanSendSingleSms,
  GetBalanceRequest,
  GetBalanceResponse,
  GetDeliveryStatusRequest,
  GetDeliveryStatusResponse,
  GetLinesRequest,
  GetLinesResponse,
  PatternParameter,
  ReceiveMessagesRequest,
  ReceiveMessagesResponse,
  SendPatternSmsRequest,
  SendPatternSmsResponse,
  SendSmsRequest,
  SendSmsResponse,
  SmsCapability,
  SmsProvider,
  SmsValidationError,
} from '@amirhossein-moloki/sms-core';
import { HttpTransport, MelipayamakClient } from '../client/melipayamak-client.js';
import {
  MelipayamakConfig,
  validateMelipayamakConfig,
} from '../config/melipayamak-config.interface.js';
import { MelipayamakErrorMapper } from '../errors/melipayamak-error-mapper.js';
import { MelipayamakResponseMapper } from '../mapper/melipayamak-response-mapper.js';

export class MelipayamakProvider
  implements
    SmsProvider,
    CanSendSingleSms,
    CanSendPatternSms,
    CanGetDeliveryStatus,
    CanGetBalance,
    CanGetLines,
    CanReceiveMessages
{
  public readonly id: string;
  public readonly displayName: string = 'ملی پیامک (Melipayamak)';
  public readonly isEnabled: boolean;
  public readonly capabilities: ReadonlySet<SmsCapability> = new Set<SmsCapability>([
    SmsCapability.SEND_SINGLE,
    SmsCapability.SEND_PATTERN,
    SmsCapability.GET_DELIVERY,
    SmsCapability.GET_BALANCE,
    SmsCapability.GET_LINES,
    SmsCapability.RECEIVE_MESSAGES,
  ]);

  private readonly config: MelipayamakConfig;
  private readonly client: MelipayamakClient;

  constructor(config: MelipayamakConfig, transport?: HttpTransport) {
    validateMelipayamakConfig(config);
    this.config = config;
    this.id = config.providerId || 'melipayamak';
    this.isEnabled = config.isEnabled ?? true;
    this.client = new MelipayamakClient(config, transport);
  }

  public supportsCapability(capability: SmsCapability): boolean {
    return this.capabilities.has(capability);
  }

  public async sendSingle(request: SendSmsRequest): Promise<SendSmsResponse> {
    const { message, options } = request;

    const to = message.recipients[0];
    const from = message.line || this.config.from || (options?.from as string);
    const text = message.messageTexts[0] || '';
    const isFlash = Boolean(options?.isFlash);

    if (!to) {
      throw new SmsValidationError(
        'Recipient mobile number is required for Melipayamak single SMS',
      );
    }

    if (!from) {
      throw new SmsValidationError(
        'Sender line number ("from") is required for Melipayamak single SMS',
      );
    }

    try {
      const response = await this.client.sendSms(to, from, text, isFlash);

      if (response.RetStatus !== 1 && Number(response.Value) <= 0) {
        throw MelipayamakErrorMapper.mapCodeToError(
          response.RetStatus !== 1 ? response.RetStatus : response.Value,
          this.id,
          'Melipayamak single SMS send failed',
        );
      }

      return MelipayamakResponseMapper.mapSendResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw MelipayamakErrorMapper.mapCodeToError(
        -1,
        this.id,
        (err as Error).message || 'Single SMS execution failed',
      );
    }
  }

  public async sendPattern(request: SendPatternSmsRequest): Promise<SendPatternSmsResponse> {
    const { mobile, templateId, parameters } = request;

    if (!templateId) {
      throw new SmsValidationError('Template ID (bodyId) is required for Melipayamak pattern SMS');
    }

    const paramValues = parameters.map((p: PatternParameter) => p.value);

    try {
      const response = await this.client.sendByBaseNumber(paramValues, mobile, templateId);

      if (response.RetStatus !== 1 && Number(response.Value) <= 0) {
        throw MelipayamakErrorMapper.mapCodeToError(
          response.RetStatus !== 1 ? response.RetStatus : response.Value,
          this.id,
          'Melipayamak pattern SMS send failed',
        );
      }

      return MelipayamakResponseMapper.mapPatternResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw MelipayamakErrorMapper.mapCodeToError(
        -1,
        this.id,
        (err as Error).message || 'Pattern SMS execution failed',
      );
    }
  }

  public async getDeliveryStatus(
    request: GetDeliveryStatusRequest,
  ): Promise<GetDeliveryStatusResponse> {
    const messageId = request.messageId;

    if (!messageId) {
      throw new SmsValidationError('Message ID (recId) is required to get delivery status');
    }

    try {
      const response = await this.client.isDelivered(messageId);

      return MelipayamakResponseMapper.mapDeliveryResponse(response, messageId);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw MelipayamakErrorMapper.mapCodeToError(
        -1,
        this.id,
        (err as Error).message || 'Get delivery status failed',
      );
    }
  }

  public async getBalance(_request?: GetBalanceRequest): Promise<GetBalanceResponse> {
    try {
      const response = await this.client.getCredit();

      return MelipayamakResponseMapper.mapBalanceResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw MelipayamakErrorMapper.mapCodeToError(
        -1,
        this.id,
        (err as Error).message || 'Get balance failed',
      );
    }
  }

  public async getLines(_request?: GetLinesRequest): Promise<GetLinesResponse> {
    try {
      const response = await this.client.getNumbers();

      return MelipayamakResponseMapper.mapLinesResponse(response);
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw MelipayamakErrorMapper.mapCodeToError(
        -1,
        this.id,
        (err as Error).message || 'Get lines failed',
      );
    }
  }

  public async receiveMessages(request?: ReceiveMessagesRequest): Promise<ReceiveMessagesResponse> {
    const location = (request?.options?.location as number | undefined) ?? 1;
    const index = request?.pageNumber ?? 0;
    const count = request?.pageSize ?? request?.count ?? 100;
    const from = (request?.options?.from as string) || '';

    try {
      const response = await this.client.getMessages(location, index, count, from);

      return MelipayamakResponseMapper.mapReceiveMessagesResponse(
        response as unknown as import('../types/melipayamak-api.types.js').MelipayamakApiResponse<
          import('../types/melipayamak-api.types.js').MelipayamakMessageItem[]
        >,
      );
    } catch (err) {
      if ((err as Error).name?.includes('Sms')) {
        throw err;
      }
      throw MelipayamakErrorMapper.mapCodeToError(
        -1,
        this.id,
        (err as Error).message || 'Receive messages failed',
      );
    }
  }
}
