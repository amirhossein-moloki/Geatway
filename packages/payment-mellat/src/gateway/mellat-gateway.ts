import {
  CallbackRequest,
  CanCreatePayment,
  CanHandleCallback,
  CanInquire,
  CanRefund,
  CanReverse,
  CanVerify,
  CreatePaymentRequest,
  CreatePaymentResponse,
  GatewayCapability,
  InquiryPaymentRequest,
  InquiryPaymentResponse,
  ParsedCallbackResult,
  PaymentGateway,
  RefundPaymentRequest,
  RefundPaymentResponse,
  ReversePaymentRequest,
  ReversePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from '@amirhossein-moloki/payment-core';
import { HttpTransport, MellatClient } from '../client/mellat-client.js';
import { MellatConfig, validateMellatConfig } from '../config/mellat-config.interface.js';
import { MellatErrorMapper } from '../errors/mellat-error-mapper.js';
import { MellatResponseMapper } from '../mapper/mellat-response-mapper.js';
import { MellatCallbackPayload } from '../types/mellat-api.types.js';

export class MellatGateway
  implements
    PaymentGateway,
    CanCreatePayment,
    CanVerify,
    CanInquire,
    CanReverse,
    CanRefund,
    CanHandleCallback
{
  public readonly id: string;
  public readonly displayName: string = 'به پرداخت ملت (Mellat)';
  public readonly isEnabled: boolean = true;
  public readonly capabilities: ReadonlySet<GatewayCapability> = new Set<GatewayCapability>([
    GatewayCapability.CREATE_PAYMENT,
    GatewayCapability.VERIFY,
    GatewayCapability.INQUIRY,
    GatewayCapability.REVERSE,
    GatewayCapability.REFUND,
    GatewayCapability.CALLBACK,
  ]);

  private readonly config: MellatConfig;
  private readonly client: MellatClient;

  constructor(config: MellatConfig, transport?: HttpTransport) {
    validateMellatConfig(config);
    this.config = config;
    this.id = config.gatewayId || 'mellat';
    this.client = new MellatClient(config, transport);
  }

  public supportsCapability(capability: GatewayCapability): boolean {
    return this.capabilities.has(capability);
  }

  public async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const { payment } = request;

    const now = new Date();
    const localDate = this.formatDate(now);
    const localTime = this.formatTime(now);

    const orderId =
      Number(payment.id.replace(/\D/g, '')) || Math.floor(Math.random() * 100000000) + 1;
    const amount = payment.amount;

    const callBackUrl = this.config.callbackUrl;
    const additionalData = (request.options?.additionalData as string) || '';
    const payerId = (request.options?.payerId as string) || '0';

    try {
      const response = await this.client.payRequest({
        orderId,
        amount,
        localDate,
        localTime,
        additionalData,
        callBackUrl,
        payerId,
        mobileNo: request.options?.mobileNo as string | undefined,
        encPan: request.options?.encPan as string | undefined,
        panHiddenMode: request.options?.panHiddenMode as string | undefined,
        cartItem: request.options?.cartItem as string | undefined,
        enc: request.options?.enc as string | undefined,
      });

      if (response.resCode !== '0' || !response.refId) {
        throw MellatErrorMapper.mapCodeToError(
          response.resCode,
          this.id,
          'Mellat payment request failed',
        );
      }

      const redirectFormData = this.client.generateRedirectFormData(response.refId, {
        mobileNo: request.options?.mobileNo as string | undefined,
        hiddenMode: request.options?.panHiddenMode as string | undefined,
        encPan: request.options?.encPan as string | undefined,
        enc: request.options?.enc as string | undefined,
        merchantName: request.options?.merchantName as string | undefined,
        merchantAddress: request.options?.merchantAddress as string | undefined,
        cartItem: request.options?.cartItem as string | undefined,
      });

      return MellatResponseMapper.mapPayRequestResponse(
        response.resCode,
        response.refId,
        redirectFormData,
        response.rawResponse,
      );
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw MellatErrorMapper.mapCodeToError('34', this.id, (err as Error).message);
    }
  }

  public async verify(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    const saleOrderId =
      Number(request.paymentId.replace(/\D/g, '')) || Number(request.options?.saleOrderId) || 1;
    const saleReferenceId =
      Number(request.reference) ||
      Number(request.gatewayTransactionId) ||
      Number(request.options?.saleReferenceId) ||
      0;
    const orderId = Number(request.options?.orderId) || saleOrderId;

    try {
      const response = await this.client.verifyRequest({
        orderId,
        saleOrderId,
        saleReferenceId,
      });

      if (response.resCode !== '0' && response.resCode !== '43') {
        throw MellatErrorMapper.mapCodeToError(
          response.resCode,
          this.id,
          'Mellat payment verify failed',
        );
      }

      return MellatResponseMapper.mapVerifyResponse(
        response.resCode,
        response.rawResponse,
        saleReferenceId,
      );
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw MellatErrorMapper.mapCodeToError('34', this.id, (err as Error).message);
    }
  }

  public async inquiry(request: InquiryPaymentRequest): Promise<InquiryPaymentResponse> {
    const saleOrderId =
      Number(request.paymentId.replace(/\D/g, '')) || Number(request.options?.saleOrderId) || 1;
    const saleReferenceId =
      Number(request.reference) ||
      Number(request.gatewayTransactionId) ||
      Number(request.options?.saleReferenceId) ||
      0;
    const orderId = Number(request.options?.orderId) || saleOrderId;

    try {
      const response = await this.client.inquiryRequest({
        orderId,
        saleOrderId,
        saleReferenceId,
      });

      return MellatResponseMapper.mapInquiryResponse(
        response.resCode,
        response.rawResponse,
        saleReferenceId,
      );
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw MellatErrorMapper.mapCodeToError('34', this.id, (err as Error).message);
    }
  }

  public async reverse(request: ReversePaymentRequest): Promise<ReversePaymentResponse> {
    const saleOrderId =
      Number(request.paymentId.replace(/\D/g, '')) || Number(request.options?.saleOrderId) || 1;
    const saleReferenceId =
      Number(request.gatewayTransactionId) || Number(request.options?.saleReferenceId) || 0;
    const orderId = Number(request.options?.orderId) || saleOrderId;

    try {
      const response = await this.client.reversalRequest({
        orderId,
        saleOrderId,
        saleReferenceId,
      });

      if (response.resCode !== '0' && response.resCode !== '48') {
        throw MellatErrorMapper.mapCodeToError(
          response.resCode,
          this.id,
          'Mellat payment reversal failed',
        );
      }

      return MellatResponseMapper.mapReversalResponse(response.resCode, response.rawResponse);
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw MellatErrorMapper.mapCodeToError('34', this.id, (err as Error).message);
    }
  }

  public async refund(request: RefundPaymentRequest): Promise<RefundPaymentResponse> {
    const saleOrderId =
      Number(request.paymentId.replace(/\D/g, '')) || Number(request.options?.saleOrderId) || 1;
    const saleReferenceId =
      Number(request.options?.saleReferenceId) || Number(request.gatewayTransactionId) || 0;
    const orderId =
      Number(request.options?.refundOrderId) || Math.floor(Math.random() * 100000000) + 1;
    const refundAmount = request.amount;

    try {
      const response = await this.client.refundRequest({
        orderId,
        saleOrderId,
        saleReferenceId,
        refundAmount,
      });

      if (response.resCode !== '0') {
        throw MellatErrorMapper.mapCodeToError(
          response.resCode,
          this.id,
          'Mellat payment refund failed',
        );
      }

      return MellatResponseMapper.mapRefundResponse(
        response.resCode,
        refundAmount,
        response.rawResponse,
      );
    } catch (err) {
      if ((err as Error).name === 'GatewayError' || (err as Error).name === 'ValidationError') {
        throw err;
      }
      throw MellatErrorMapper.mapCodeToError('34', this.id, (err as Error).message);
    }
  }

  public async parseCallback(request: CallbackRequest): Promise<ParsedCallbackResult> {
    const payload = (
      request.body && Object.keys(request.body).length > 0 ? request.body : request.query
    ) as MellatCallbackPayload;

    return MellatResponseMapper.mapCallback(payload);
  }

  private formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  private formatTime(date: Date): string {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}${mm}${ss}`;
  }
}
