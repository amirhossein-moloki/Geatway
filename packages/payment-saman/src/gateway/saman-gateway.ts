import {
  CallbackRequest,
  CanCreatePayment,
  CanHandleCallback,
  CanReverse,
  CanVerify,
  CreatePaymentRequest,
  CreatePaymentResponse,
  GatewayCapability,
  ParsedCallbackResult,
  PaymentGateway,
  ReversePaymentRequest,
  ReversePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from '@company/payment-core';
import { HttpTransport, SamanClient } from '../client/saman-client.js';
import { SamanConfig, validateSamanConfig } from '../config/saman-config.interface.js';
import { SamanErrorMapper } from '../errors/saman-error-mapper.js';
import { SamanResponseMapper } from '../mapper/saman-response-mapper.js';
import { SamanCallbackPayload } from '../types/saman-api.types.js';

export class SamanGateway
  implements PaymentGateway, CanCreatePayment, CanVerify, CanReverse, CanHandleCallback
{
  public readonly id: string;
  public readonly displayName: string = 'سامان کیش / SEP';
  public readonly isEnabled: boolean = true;
  public readonly capabilities: ReadonlySet<GatewayCapability> = new Set<GatewayCapability>([
    GatewayCapability.CREATE_PAYMENT,
    GatewayCapability.VERIFY,
    GatewayCapability.REVERSE,
    GatewayCapability.CALLBACK,
  ]);

  private readonly config: SamanConfig;
  private readonly client: SamanClient;

  constructor(config: SamanConfig, transport?: HttpTransport) {
    validateSamanConfig(config);
    this.config = config;
    this.id = config.gatewayId || 'saman';
    this.client = new SamanClient(config, transport);
  }

  public supportsCapability(capability: GatewayCapability): boolean {
    return this.capabilities.has(capability);
  }

  public async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const { payment, options } = request;

    const amount = payment.amount;
    const resNum = (options?.resNum as string) || payment.id;
    const cellNumber =
      (options?.cellNumber as string | number) || (options?.mobile as string | number);

    try {
      const response = await this.client.getToken({
        ResNum: resNum,
        Amount: amount,
        CellNumber: cellNumber,
        ResNum1: options?.resNum1 as string | undefined,
        ResNum2: options?.resNum2 as string | undefined,
      });

      const statusNum = Number(response.status);
      if ((statusNum !== 1 && response.status !== '1') || !response.token) {
        throw SamanErrorMapper.mapCodeToError(
          response.errorCode || response.status || -1,
          this.id,
          response.errorDesc || 'Saman token request failed',
        );
      }

      const redirectInfo = this.client.getPaymentRedirectInfo(response.token);
      return SamanResponseMapper.mapTokenResponse(response, redirectInfo.url);
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw SamanErrorMapper.mapCodeToError(-1, this.id, (err as Error).message);
    }
  }

  public async verify(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    const refNum =
      request.reference || request.gatewayTransactionId || (request.options?.refNum as string);

    if (!refNum) {
      throw SamanErrorMapper.mapCodeToError(5, this.id, 'Missing RefNum for Saman verify');
    }

    try {
      const response = await this.client.verifyTransaction({ RefNum: refNum });

      const resultCode = Number(response.ResultCode);
      if (resultCode !== 0 && resultCode !== 7) {
        throw SamanErrorMapper.mapCodeToError(
          response.ResultCode,
          this.id,
          response.ResultDescription || 'Saman verify failed',
        );
      }

      return SamanResponseMapper.mapVerifyResponse(response);
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw SamanErrorMapper.mapCodeToError(-1, this.id, (err as Error).message);
    }
  }

  public async reverse(request: ReversePaymentRequest): Promise<ReversePaymentResponse> {
    const refNum = request.gatewayTransactionId || (request.options?.refNum as string);

    if (!refNum) {
      throw SamanErrorMapper.mapCodeToError(5, this.id, 'Missing RefNum for Saman reverse');
    }

    try {
      const response = await this.client.reverseTransaction({ RefNum: refNum });

      const resultCode = Number(response.ResultCode);
      if (resultCode !== 0) {
        throw SamanErrorMapper.mapCodeToError(
          response.ResultCode,
          this.id,
          response.ResultDescription || 'Saman reverse failed',
        );
      }

      return SamanResponseMapper.mapReverseResponse(response);
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw SamanErrorMapper.mapCodeToError(-1, this.id, (err as Error).message);
    }
  }

  public async parseCallback(request: CallbackRequest): Promise<ParsedCallbackResult> {
    const payload = (
      request.body && Object.keys(request.body).length > 0 ? request.body : request.query
    ) as SamanCallbackPayload;

    return SamanResponseMapper.mapCallback(payload);
  }
}
