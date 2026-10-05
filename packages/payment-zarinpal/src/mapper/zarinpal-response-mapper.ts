import {
  CreatePaymentResponse,
  ParsedCallbackResult,
  PaymentStatus,
  VerifyPaymentResponse,
} from '@company/payment-core';
import {
  PaymentRequestData,
  PaymentVerificationData,
  ZarinpalCallbackPayload,
  ZarinpalGraphQLResponse,
} from '../types/zarinpal-api.types.js';

export class ZarinpalResponseMapper {
  public static mapRequestResponse(
    response: ZarinpalGraphQLResponse<PaymentRequestData>,
    redirectUrl: string,
  ): CreatePaymentResponse {
    const data = response.data?.PaymentRequest;
    const isSuccess = data?.code === 100 && Boolean(data?.authority);

    return {
      success: isSuccess,
      redirectUrl: isSuccess ? redirectUrl : undefined,
      gatewayTransactionId: data?.authority,
      status: isSuccess ? PaymentStatus.PENDING : PaymentStatus.FAILED,
      metadata: {
        code: data?.code,
        authority: data?.authority,
        feeType: data?.fee_type,
        fee: data?.fee,
        message: data?.message,
      },
      rawResponse: response,
    };
  }

  public static mapVerifyResponse(
    response: ZarinpalGraphQLResponse<PaymentVerificationData>,
  ): VerifyPaymentResponse {
    const data = response.data?.PaymentVerification;
    const isSuccess = data?.code === 100 || data?.code === 101;

    return {
      success: isSuccess,
      status: isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
      reference: data?.ref_id ? String(data.ref_id) : undefined,
      cardMask: data?.card_pan,
      metadata: {
        code: data?.code,
        cardPan: data?.card_pan,
        cardHash: data?.card_hash,
        feeType: data?.fee_type,
        fee: data?.fee,
        message: data?.message,
      },
      rawResponse: response,
    };
  }

  public static mapCallback(payload: ZarinpalCallbackPayload): ParsedCallbackResult {
    const statusStr = String(payload.Status ?? payload.status ?? '');
    const isSuccess = statusStr.toUpperCase() === 'OK';
    const authority = payload.Authority || payload.authority;

    return {
      gatewayTransactionId: authority ? String(authority) : undefined,
      isSuccess,
      rawData: payload as Record<string, unknown>,
    };
  }
}
