import {
  CallbackRequest,
  CanCreatePayment,
  CanHandleCallback,
  CanInquire,
  CanVerify,
  CreatePaymentRequest,
  CreatePaymentResponse,
  GatewayCapability,
  InquiryPaymentRequest,
  InquiryPaymentResponse,
  ParsedCallbackResult,
  PaymentGateway,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from '@amirhossein-moloki/payment-core';
import { HttpTransport, ZibalClient } from '../client/zibal-client.js';
import { ZibalConfig, validateZibalConfig } from '../config/zibal-config.interface.js';
import { ZibalErrorMapper } from '../errors/zibal-error-mapper.js';
import { ZibalResponseMapper } from '../mapper/zibal-response-mapper.js';
import { ZibalCallbackPayload, ZibalMultiplexingInfo } from '../types/zibal-api.types.js';

export class ZibalGateway
  implements PaymentGateway, CanCreatePayment, CanVerify, CanInquire, CanHandleCallback
{
  public readonly id: string;
  public readonly displayName: string = 'زیبال (Zibal)';
  public readonly isEnabled: boolean = true;
  public readonly capabilities: ReadonlySet<GatewayCapability> = new Set<GatewayCapability>([
    GatewayCapability.CREATE_PAYMENT,
    GatewayCapability.VERIFY,
    GatewayCapability.INQUIRY,
    GatewayCapability.CALLBACK,
  ]);

  private readonly config: ZibalConfig;
  private readonly client: ZibalClient;

  constructor(config: ZibalConfig, transport?: HttpTransport) {
    validateZibalConfig(config);
    this.config = config;
    this.id = config.gatewayId || 'zibal';
    this.client = new ZibalClient(config, transport);
  }

  public supportsCapability(capability: GatewayCapability): boolean {
    return this.capabilities.has(capability);
  }

  public async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const { payment, options } = request;

    const amount = payment.amount;
    const callbackUrl = (options?.callbackUrl as string) || this.config.callbackUrl;
    const description = (options?.description as string) || payment.description;
    const orderId = payment.id;

    const isLazy = Boolean(options?.isLazy);

    try {
      const response = await this.client.requestPayment(
        {
          amount,
          callbackUrl,
          description,
          orderId,
          mobile: options?.mobile as string | undefined,
          allowedCards: options?.allowedCards as string[] | undefined,
          nationalCode: options?.nationalCode as string | undefined,
          checkMobileWithCard: options?.checkMobileWithCard as boolean | undefined,
          percentMode: options?.percentMode as number | undefined,
          feeMode: options?.feeMode as number | undefined,
          multiplexingInfos: options?.multiplexingInfos as ZibalMultiplexingInfo[] | undefined,
        },
        isLazy,
      );

      if (response.result !== 100) {
        throw ZibalErrorMapper.mapResultToError(
          response.result,
          this.id,
          'Zibal payment request failed',
        );
      }

      const redirectUrl = this.client.getPaymentUrl(response.trackId);
      return ZibalResponseMapper.mapRequestResponse(response, redirectUrl);
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw ZibalErrorMapper.mapResultToError(-2, this.id, (err as Error).message);
    }
  }

  public async verify(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    const trackId =
      Number(request.gatewayTransactionId) ||
      Number(request.reference) ||
      Number(request.options?.trackId);

    if (!trackId) {
      throw ZibalErrorMapper.mapResultToError(203, this.id, 'Invalid trackId for verify');
    }

    const isLazy = Boolean(request.options?.isLazy);

    try {
      const response = await this.client.verifyPayment({ trackId }, isLazy);

      if (response.result !== 100 && response.result !== 201) {
        throw ZibalErrorMapper.mapResultToError(
          response.result,
          this.id,
          'Zibal verify payment failed',
        );
      }

      return ZibalResponseMapper.mapVerifyResponse(response);
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw ZibalErrorMapper.mapResultToError(-2, this.id, (err as Error).message);
    }
  }

  public async inquiry(request: InquiryPaymentRequest): Promise<InquiryPaymentResponse> {
    const trackId =
      Number(request.gatewayTransactionId) ||
      Number(request.reference) ||
      Number(request.options?.trackId);

    if (!trackId) {
      throw ZibalErrorMapper.mapResultToError(203, this.id, 'Invalid trackId for inquiry');
    }

    try {
      const response = await this.client.inquiryPayment({ trackId });

      if (response.result !== 100) {
        throw ZibalErrorMapper.mapResultToError(
          response.result,
          this.id,
          'Zibal inquiry payment failed',
        );
      }

      return ZibalResponseMapper.mapInquiryResponse(response);
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw ZibalErrorMapper.mapResultToError(-2, this.id, (err as Error).message);
    }
  }

  public async parseCallback(request: CallbackRequest): Promise<ParsedCallbackResult> {
    const payload = (
      request.body && Object.keys(request.body).length > 0 ? request.body : request.query
    ) as ZibalCallbackPayload;

    return ZibalResponseMapper.mapCallback(payload);
  }
}
