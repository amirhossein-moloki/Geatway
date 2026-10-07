import {
  CreatePaymentResponse,
  ParsedCallbackResult,
  PaymentStatus,
  ReversePaymentResponse,
  VerifyPaymentResponse,
} from '@amirhossein-moloki/payment-core';
import {
  SamanCallbackPayload,
  SamanGetTokenResponse,
  SamanReverseResponse,
  SamanVerifyResponse,
} from '../types/saman-api.types.js';

export class SamanResponseMapper {
  public static mapTokenResponse(
    response: SamanGetTokenResponse,
    redirectUrl: string,
  ): CreatePaymentResponse {
    const statusNum = Number(response.status);
    const isSuccess = (statusNum === 1 || response.status === '1') && Boolean(response.token);

    return {
      success: isSuccess,
      redirectUrl: isSuccess ? redirectUrl : undefined,
      gatewayTransactionId: response.token,
      status: isSuccess ? PaymentStatus.PENDING : PaymentStatus.FAILED,
      metadata: {
        status: response.status,
        token: response.token,
        errorCode: response.errorCode,
        errorDesc: response.errorDesc,
      },
      rawResponse: response,
    };
  }

  public static mapVerifyResponse(response: SamanVerifyResponse): VerifyPaymentResponse {
    const resultCode = Number(response.ResultCode);
    const isSuccess = resultCode === 0;

    return {
      success: isSuccess,
      status: isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
      reference: response.TransactionDetail?.RefNum || response.TransactionDetail?.Rrn,
      cardMask: response.TransactionDetail?.MaskedPan,
      metadata: {
        resultCode: response.ResultCode,
        resultDescription: response.ResultDescription,
        transactionDetail: response.TransactionDetail,
      },
      rawResponse: response,
    };
  }

  public static mapReverseResponse(response: SamanReverseResponse): ReversePaymentResponse {
    const resultCode = Number(response.ResultCode);
    const isSuccess = resultCode === 0;

    return {
      success: isSuccess,
      metadata: {
        resultCode: response.ResultCode,
        resultDescription: response.ResultDescription,
      },
      rawResponse: response,
    };
  }

  public static mapCallback(payload: SamanCallbackPayload): ParsedCallbackResult {
    const stateStr = String(payload.State ?? payload.status ?? '');
    const isSuccess =
      stateStr.toUpperCase() === 'OK' || payload.Status === 0 || payload.Status === '0';
    const refNum = payload.RefNum ? String(payload.RefNum) : undefined;
    const resNum = payload.ResNum ? String(payload.ResNum) : undefined;

    return {
      paymentId: resNum,
      gatewayTransactionId: refNum,
      reference: payload.Rrn ? String(payload.Rrn) : refNum,
      isSuccess,
      rawData: payload as Record<string, unknown>,
    };
  }
}
