import {
  CallbackRequest,
  CanCreatePayment,
  CanHandleCallback,
  CanVerify,
  CreatePaymentRequest,
  CreatePaymentResponse,
  GatewayCapability,
  ParsedCallbackResult,
  PaymentGateway,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from '@company/payment-core';
import { HttpTransport, ZarinpalClient } from '../client/zarinpal-client.js';
import { ZarinpalConfig, validateZarinpalConfig } from '../config/zarinpal-config.interface.js';
import { ZarinpalErrorMapper } from '../errors/zarinpal-error-mapper.js';
import { ZarinpalResponseMapper } from '../mapper/zarinpal-response-mapper.js';
import { ZarinpalCallbackPayload } from '../types/zarinpal-api.types.js';

export class ZarinpalGateway
  implements PaymentGateway, CanCreatePayment, CanVerify, CanHandleCallback
{
  public readonly id: string;
  public readonly displayName: string = 'زرین‌پال (Zarinpal)';
  public readonly isEnabled: boolean = true;
  public readonly capabilities: ReadonlySet<GatewayCapability> = new Set<GatewayCapability>([
    GatewayCapability.CREATE_PAYMENT,
    GatewayCapability.VERIFY,
    GatewayCapability.CALLBACK,
  ]);

  private readonly config: ZarinpalConfig;
  private readonly client: ZarinpalClient;

  constructor(config: ZarinpalConfig, transport?: HttpTransport) {
    validateZarinpalConfig(config);
    this.config = config;
    this.id = config.gatewayId || 'zarinpal';
    this.client = new ZarinpalClient(config, transport);
  }

  public supportsCapability(capability: GatewayCapability): boolean {
    return this.capabilities.has(capability);
  }

  public async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const { payment, options } = request;

    const amount = payment.amount;
    const callbackUrl = (options?.callbackUrl as string) || this.config.callbackUrl;
    const description = (options?.description as string) || payment.description;
    const merchantId = options?.merchantId as string | undefined;

    try {
      const response = await this.client.requestPayment({
        merchantId,
        amount,
        callbackUrl,
        description,
        metadata: options?.metadata as Record<string, unknown> | undefined,
      });

      if (response.errors && response.errors.length > 0) {
        const firstError = response.errors[0];
        throw ZarinpalErrorMapper.mapCodeToError(
          -52,
          this.id,
          firstError?.message || 'GraphQL Error',
        );
      }

      const pr = response.data?.PaymentRequest;
      if (!pr || (pr.code !== 100 && pr.code !== 101) || !pr.authority) {
        throw ZarinpalErrorMapper.mapCodeToError(
          pr?.code || -52,
          this.id,
          pr?.message || 'Zarinpal payment request failed',
        );
      }

      const redirectUrl = this.client.getStartPayUrl(pr.authority);
      return ZarinpalResponseMapper.mapRequestResponse(response, redirectUrl);
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw ZarinpalErrorMapper.mapCodeToError(-52, this.id, (err as Error).message);
    }
  }

  public async verify(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    const authority =
      request.gatewayTransactionId || request.reference || (request.options?.authority as string);

    if (!authority) {
      throw ZarinpalErrorMapper.mapCodeToError(-54, this.id, 'Missing authority for verification');
    }

    const merchantId = request.options?.merchantId as string | undefined;

    try {
      const response = await this.client.verifyPayment({
        merchantId,
        amount: request.amount,
        authority,
      });

      if (response.errors && response.errors.length > 0) {
        const firstError = response.errors[0];
        throw ZarinpalErrorMapper.mapCodeToError(
          -52,
          this.id,
          firstError?.message || 'GraphQL Error',
        );
      }

      const pv = response.data?.PaymentVerification;
      if (!pv || (pv.code !== 100 && pv.code !== 101)) {
        throw ZarinpalErrorMapper.mapCodeToError(
          pv?.code || -52,
          this.id,
          pv?.message || 'Zarinpal verify failed',
        );
      }

      return ZarinpalResponseMapper.mapVerifyResponse(response);
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw ZarinpalErrorMapper.mapCodeToError(-52, this.id, (err as Error).message);
    }
  }

  public async parseCallback(request: CallbackRequest): Promise<ParsedCallbackResult> {
    const payload = (
      request.query && Object.keys(request.query).length > 0 ? request.query : request.body
    ) as ZarinpalCallbackPayload;

    return ZarinpalResponseMapper.mapCallback(payload);
  }
}
