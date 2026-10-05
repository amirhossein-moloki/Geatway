import {
  CreatePaymentResponse,
  InquiryPaymentResponse,
  ParsedCallbackResult,
  PaymentStatus,
  RefundPaymentResponse,
  ReversePaymentResponse,
  VerifyPaymentResponse,
} from '@company/payment-core';
import { RedirectFormData } from '../client/mellat-client.js';
import { MellatCallbackPayload } from '../types/mellat-api.types.js';

export class MellatResponseMapper {
  public static mapPayRequestResponse(
    resCode: string,
    refId: string | undefined,
    redirectFormData: RedirectFormData,
    rawResponse: string,
  ): CreatePaymentResponse {
    const isSuccess = resCode === '0' && Boolean(refId);

    return {
      success: isSuccess,
      redirectUrl: redirectFormData.actionUrl,
      gatewayTransactionId: refId,
      reference: refId,
      status: isSuccess ? PaymentStatus.PENDING : PaymentStatus.FAILED,
      metadata: {
        resCode,
        refId,
        redirectFormData,
      },
      rawResponse: {
        resCode,
        refId,
        rawResponseBody: rawResponse,
      },
    };
  }

  public static mapCallback(
    payload: MellatCallbackPayload,
    expectedRefId?: string,
    expectedSaleOrderId?: string | number,
  ): ParsedCallbackResult {
    const resCode = payload.ResCode !== undefined ? String(payload.ResCode) : undefined;
    const refId = payload.RefId !== undefined ? String(payload.RefId) : undefined;
    const saleOrderId = payload.SaleOrderId !== undefined ? String(payload.SaleOrderId) : undefined;
    const saleReferenceId =
      payload.SaleReferenceId !== undefined ? String(payload.SaleReferenceId) : undefined;

    let isSuccess = resCode === '0';

    if (expectedRefId && refId && expectedRefId !== refId) {
      isSuccess = false;
    }

    if (expectedSaleOrderId && saleOrderId && String(expectedSaleOrderId) !== saleOrderId) {
      isSuccess = false;
    }

    return {
      paymentId: saleOrderId,
      gatewayTransactionId: saleReferenceId || refId,
      reference: saleReferenceId || refId,
      isSuccess,
      rawData: payload,
    };
  }

  public static mapVerifyResponse(
    resCode: string,
    rawResponse: string,
    saleReferenceId?: string | number,
  ): VerifyPaymentResponse {
    const isSuccess = resCode === '0' || resCode === '43';

    return {
      success: isSuccess,
      status: isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
      reference: saleReferenceId ? String(saleReferenceId) : undefined,
      gatewayTransactionId: saleReferenceId ? String(saleReferenceId) : undefined,
      metadata: {
        resCode,
        isAlreadyVerified: resCode === '43',
      },
      rawResponse: {
        resCode,
        rawResponseBody: rawResponse,
      },
    };
  }

  public static mapInquiryResponse(
    resCode: string,
    rawResponse: string,
    saleReferenceId?: string | number,
  ): InquiryPaymentResponse {
    const isSuccess = resCode === '0' || resCode === '43' || resCode === '45';

    let status = PaymentStatus.PENDING;
    if (isSuccess) {
      status = PaymentStatus.SUCCESS;
    } else if (resCode === '48') {
      status = PaymentStatus.REVERSED;
    } else if (resCode === '17') {
      status = PaymentStatus.CANCELLED;
    } else if (['42', '44', '55'].includes(resCode)) {
      status = PaymentStatus.FAILED;
    }

    return {
      success: isSuccess,
      status,
      reference: saleReferenceId ? String(saleReferenceId) : undefined,
      gatewayTransactionId: saleReferenceId ? String(saleReferenceId) : undefined,
      metadata: {
        resCode,
      },
      rawResponse: {
        resCode,
        rawResponseBody: rawResponse,
      },
    };
  }

  public static mapReversalResponse(resCode: string, rawResponse: string): ReversePaymentResponse {
    const isSuccess = resCode === '0' || resCode === '48';

    return {
      success: isSuccess,
      reverseTransactionId: undefined,
      metadata: {
        resCode,
        isAlreadyReversed: resCode === '48',
      },
      rawResponse: {
        resCode,
        rawResponseBody: rawResponse,
      },
    };
  }

  public static mapRefundResponse(
    resCode: string,
    refundAmount: number,
    rawResponse: string,
  ): RefundPaymentResponse {
    const isSuccess = resCode === '0';

    return {
      success: isSuccess,
      amountRefunded: isSuccess ? refundAmount : 0,
      metadata: {
        resCode,
      },
      rawResponse: {
        resCode,
        rawResponseBody: rawResponse,
      },
    };
  }
}
