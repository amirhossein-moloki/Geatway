export interface SmsirApiResponse<T = unknown> {
  status: number;
  message: string;
  data: T;
}

export interface SmsirSendBulkData {
  packId?: string;
  messageIds?: Array<number | string>;
  cost?: number;
}

export interface SmsirVerifyData {
  messageId?: number | string;
  cost?: number;
}

export interface SmsirCancelScheduledData {
  returnedCreditCount?: number;
  smsCount?: number;
}

export interface SmsirDeliveryDataItem {
  messageId?: number | string;
  mobile?: string | number;
  messageText?: string;
  sendDateTime?: number;
  lineNumber?: string | number;
  cost?: number;
  deliveryState?: number;
  deliveryDateTime?: number;
}

export interface SmsirLineData {
  lineNumber: string;
  isDefault?: boolean;
}

export interface SmsirReceiveMessageItem {
  messageId?: number | string;
  lineNumber?: string;
  mobile?: string;
  messageText?: string;
  receiveDateTime?: number;
}
