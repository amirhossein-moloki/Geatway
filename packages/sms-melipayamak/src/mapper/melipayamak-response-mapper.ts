import {
  DeliveryStatusItem,
  GetBalanceResponse,
  GetDeliveryStatusResponse,
  GetLinesResponse,
  LineItem,
  ReceiveMessagesResponse,
  ReceivedMessageItem,
  SendPatternSmsResponse,
  SendSmsResponse,
  SmsStatus,
} from '@amirhossein-moloki/sms-core';
import { MelipayamakApiResponse, MelipayamakMessageItem } from '../types/melipayamak-api.types.js';

export class MelipayamakResponseMapper {
  public static mapSendResponse(response: MelipayamakApiResponse<string | number>): SendSmsResponse {
    const isSuccess = response.RetStatus === 1 || Number(response.Value) > 0;
    const recId = isSuccess ? String(response.Value) : undefined;

    return {
      success: isSuccess,
      messageId: recId,
      status: isSuccess ? SmsStatus.SENT : SmsStatus.FAILED,
      metadata: {
        retStatus: response.RetStatus,
        strRetStatus: response.StrRetStatus,
      },
      rawResponse: response,
    };
  }

  public static mapPatternResponse(
    response: MelipayamakApiResponse<string | number>,
  ): SendPatternSmsResponse {
    const isSuccess = response.RetStatus === 1 || Number(response.Value) > 0;
    const recId = isSuccess ? String(response.Value) : undefined;

    return {
      success: isSuccess,
      messageId: recId,
      status: isSuccess ? SmsStatus.SENT : SmsStatus.FAILED,
      metadata: {
        retStatus: response.RetStatus,
        strRetStatus: response.StrRetStatus,
      },
      rawResponse: response,
    };
  }

  public static mapDeliveryResponse(
    response: MelipayamakApiResponse<string | number>,
    messageId: string | number,
  ): GetDeliveryStatusResponse {
    const isSuccess = response.RetStatus === 1;
    const deliveryState = response.Value;

    // Delivery states for Melipayamak:
    // 0: Sent to provider
    // 1: Delivered to handset
    // 2: Failed/Undelivered
    // 3: Blacklist/Blocked
    // 8: Pending
    let smsStatus: SmsStatus = SmsStatus.SENT;
    const stateNum = Number(deliveryState);

    if (stateNum === 1) {
      smsStatus = SmsStatus.DELIVERED;
    } else if (stateNum === 2 || stateNum === 3) {
      smsStatus = SmsStatus.FAILED;
    } else if (stateNum === 8 || stateNum === 0) {
      smsStatus = SmsStatus.PENDING;
    }

    const statusItem: DeliveryStatusItem = {
      messageId,
      deliveryState: String(deliveryState),
      deliveryStatus: smsStatus,
    };

    return {
      success: isSuccess,
      statuses: [statusItem],
      rawResponse: response,
    };
  }

  public static mapBalanceResponse(
    response: MelipayamakApiResponse<string | number>,
  ): GetBalanceResponse {
    const isSuccess = response.RetStatus === 1;
    const balance = isSuccess ? Number(response.Value) || 0 : 0;

    return {
      success: isSuccess,
      balance,
      currency: 'IRR',
      rawResponse: response,
    };
  }

  public static mapLinesResponse(
    response: MelipayamakApiResponse<string[] | string>,
  ): GetLinesResponse {
    const isSuccess = response.RetStatus === 1;
    let lines: LineItem[] = [];

    if (isSuccess && response.Value) {
      if (Array.isArray(response.Value)) {
        lines = response.Value.map((num) => ({ lineNumber: num }));
      } else if (typeof response.Value === 'string') {
        try {
          const parsed = JSON.parse(response.Value);
          if (Array.isArray(parsed)) {
            lines = parsed.map((item: unknown) => ({
              lineNumber: typeof item === 'string' ? item : String((item as { Number?: string }).Number || item),
            }));
          } else {
            lines = [{ lineNumber: response.Value }];
          }
        } catch {
          lines = [{ lineNumber: response.Value }];
        }
      }
    }

    return {
      success: isSuccess,
      lines,
      rawResponse: response,
    };
  }

  public static mapReceiveMessagesResponse(
    response: MelipayamakApiResponse<MelipayamakMessageItem[] | string>,
  ): ReceiveMessagesResponse {
    const isSuccess = response.RetStatus === 1;
    let messages: ReceivedMessageItem[] = [];

    if (isSuccess && response.Value) {
      let rawList: MelipayamakMessageItem[] = [];
      if (Array.isArray(response.Value)) {
        rawList = response.Value;
      } else if (typeof response.Value === 'string') {
        try {
          rawList = JSON.parse(response.Value);
        } catch {
          rawList = [];
        }
      }

      messages = rawList.map((item) => ({
        messageId: item.MsgID || '',
        lineNumber: item.To || '',
        mobile: item.From || '',
        messageText: item.Text || '',
        receiveDateTime: item.Date ? new Date(item.Date) : new Date(),
      }));
    }

    return {
      success: isSuccess,
      messages,
      rawResponse: response,
    };
  }
}
