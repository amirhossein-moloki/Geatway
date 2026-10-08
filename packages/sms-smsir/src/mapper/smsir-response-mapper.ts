import {
  CancelScheduledSmsResponse,
  DeliveryStatusItem,
  GetBalanceResponse,
  GetDeliveryStatusResponse,
  GetLinesResponse,
  LineItem,
  ReceiveMessagesResponse,
  ReceivedMessageItem,
  SendBulkSmsResponse,
  SendLikeToLikeSmsResponse,
  SendPatternSmsResponse,
  SendSmsResponse,
  SmsStatus,
} from '@amirhossein-moloki/sms-core';
import {
  SmsirApiResponse,
  SmsirCancelScheduledData,
  SmsirDeliveryDataItem,
  SmsirLineData,
  SmsirReceiveMessageItem,
  SmsirSendBulkData,
  SmsirVerifyData,
} from '../types/smsir-api.types.js';

export class SmsirResponseMapper {
  public static mapSendResponse(
    response: SmsirApiResponse<SmsirSendBulkData>,
  ): SendSmsResponse {
    const isSuccess = response.status === 1;
    const msgId = response.data?.messageIds?.[0];

    return {
      success: isSuccess,
      messageId: msgId !== undefined ? String(msgId) : undefined,
      packId: response.data?.packId,
      cost: response.data?.cost,
      status: isSuccess ? SmsStatus.SENT : SmsStatus.FAILED,
      rawResponse: response,
    };
  }

  public static mapBulkResponse(
    response: SmsirApiResponse<SmsirSendBulkData>,
  ): SendBulkSmsResponse {
    const isSuccess = response.status === 1;

    return {
      success: isSuccess,
      packId: response.data?.packId,
      messageIds: response.data?.messageIds,
      cost: response.data?.cost,
      status: isSuccess ? SmsStatus.SENT : SmsStatus.FAILED,
      rawResponse: response,
    };
  }

  public static mapLikeToLikeResponse(
    response: SmsirApiResponse<SmsirSendBulkData>,
  ): SendLikeToLikeSmsResponse {
    const isSuccess = response.status === 1;

    return {
      success: isSuccess,
      packId: response.data?.packId,
      messageIds: response.data?.messageIds,
      cost: response.data?.cost,
      status: isSuccess ? SmsStatus.SENT : SmsStatus.FAILED,
      rawResponse: response,
    };
  }

  public static mapPatternResponse(
    response: SmsirApiResponse<SmsirVerifyData>,
  ): SendPatternSmsResponse {
    const isSuccess = response.status === 1;

    return {
      success: isSuccess,
      messageId: response.data?.messageId !== undefined ? String(response.data.messageId) : undefined,
      cost: response.data?.cost,
      status: isSuccess ? SmsStatus.SENT : SmsStatus.FAILED,
      rawResponse: response,
    };
  }

  public static mapDeliveryResponse(
    response: SmsirApiResponse<SmsirDeliveryDataItem[] | SmsirDeliveryDataItem>,
  ): GetDeliveryStatusResponse {
    const isSuccess = response.status === 1;
    const list = Array.isArray(response.data)
      ? response.data
      : response.data
        ? [response.data]
        : [];

    const statuses: DeliveryStatusItem[] = list.map((item) => {
      let smsStatus: SmsStatus = SmsStatus.SENT;
      const state = Number(item.deliveryState);

      if (state === 2) {
        smsStatus = SmsStatus.DELIVERED;
      } else if (state === 3 || state === 4) {
        smsStatus = SmsStatus.FAILED;
      } else if (state === 1 || state === 5) {
        smsStatus = SmsStatus.PENDING;
      }

      return {
        messageId: item.messageId || '',
        mobile: item.mobile ? String(item.mobile) : undefined,
        messageText: item.messageText,
        deliveryState: item.deliveryState,
        deliveryStatus: smsStatus,
        deliveryDateTime: item.deliveryDateTime ? new Date(item.deliveryDateTime) : null,
      };
    });

    return {
      success: isSuccess,
      statuses,
      rawResponse: response,
    };
  }

  public static mapBalanceResponse(response: SmsirApiResponse<number>): GetBalanceResponse {
    const isSuccess = response.status === 1;

    return {
      success: isSuccess,
      balance: isSuccess && typeof response.data === 'number' ? response.data : 0,
      currency: 'IRR',
      rawResponse: response,
    };
  }

  public static mapLinesResponse(
    response: SmsirApiResponse<SmsirLineData[] | string[]>,
  ): GetLinesResponse {
    const isSuccess = response.status === 1;
    let lines: LineItem[] = [];

    if (isSuccess && Array.isArray(response.data)) {
      lines = response.data.map((item) => {
        if (typeof item === 'string') {
          return { lineNumber: item };
        }
        return {
          lineNumber: item.lineNumber,
          isDefault: item.isDefault,
        };
      });
    }

    return {
      success: isSuccess,
      lines,
      rawResponse: response,
    };
  }

  public static mapReceiveMessagesResponse(
    response: SmsirApiResponse<SmsirReceiveMessageItem[]>,
  ): ReceiveMessagesResponse {
    const isSuccess = response.status === 1;
    const list = Array.isArray(response.data) ? response.data : [];

    const messages: ReceivedMessageItem[] = list.map((item) => ({
      messageId: item.messageId || '',
      lineNumber: item.lineNumber || '',
      mobile: item.mobile || '',
      messageText: item.messageText || '',
      receiveDateTime: item.receiveDateTime ? new Date(item.receiveDateTime) : new Date(),
    }));

    return {
      success: isSuccess,
      messages,
      rawResponse: response,
    };
  }

  public static mapCancelScheduledResponse(
    response: SmsirApiResponse<SmsirCancelScheduledData>,
  ): CancelScheduledSmsResponse {
    const isSuccess = response.status === 1;

    return {
      success: isSuccess,
      returnedCreditCount: response.data?.returnedCreditCount,
      smsCount: response.data?.smsCount,
      rawResponse: response,
    };
  }
}
