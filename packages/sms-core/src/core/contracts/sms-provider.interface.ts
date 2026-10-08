import { SmsCapability } from '../domain/capabilities/sms-capability.enum.js';
import { PatternParameter, SmsMessage } from '../domain/sms/sms-message.entity.js';
import { SmsStatus } from '../domain/sms/sms-status.enum.js';

// DTOs for SMS Operations

export interface SendSmsRequest {
  readonly message: SmsMessage;
  readonly options?: Record<string, unknown>;
}

export interface SendSmsResponse {
  readonly success: boolean;
  readonly messageId?: string | number;
  readonly packId?: string;
  readonly cost?: number;
  readonly status: SmsStatus;
  readonly metadata?: Record<string, unknown>;
  readonly rawResponse?: unknown;
}

export interface SendBulkSmsRequest {
  readonly lineNumber?: string | number;
  readonly messageText: string;
  readonly mobiles: string[];
  readonly sendDateTime?: Date | number | null;
  readonly options?: Record<string, unknown>;
}

export interface SendBulkSmsResponse {
  readonly success: boolean;
  readonly packId?: string;
  readonly messageIds?: Array<string | number>;
  readonly cost?: number;
  readonly status: SmsStatus;
  readonly metadata?: Record<string, unknown>;
  readonly rawResponse?: unknown;
}

export interface SendLikeToLikeSmsRequest {
  readonly lineNumber?: string | number;
  readonly messageTexts: string[];
  readonly mobiles: string[];
  readonly sendDateTime?: Date | number | null;
  readonly options?: Record<string, unknown>;
}

export interface SendLikeToLikeSmsResponse {
  readonly success: boolean;
  readonly packId?: string;
  readonly messageIds?: Array<string | number>;
  readonly cost?: number;
  readonly status: SmsStatus;
  readonly metadata?: Record<string, unknown>;
  readonly rawResponse?: unknown;
}

export interface SendPatternSmsRequest {
  readonly mobile: string;
  readonly templateId: string | number;
  readonly parameters: PatternParameter[];
  readonly options?: Record<string, unknown>;
}

export interface SendPatternSmsResponse {
  readonly success: boolean;
  readonly messageId?: string | number;
  readonly cost?: number;
  readonly status: SmsStatus;
  readonly metadata?: Record<string, unknown>;
  readonly rawResponse?: unknown;
}

export interface DeliveryStatusItem {
  readonly messageId: string | number;
  readonly mobile?: string;
  readonly messageText?: string;
  readonly deliveryState?: number | string;
  readonly deliveryStatus: SmsStatus;
  readonly deliveryDateTime?: Date | number | null;
}

export interface GetDeliveryStatusRequest {
  readonly messageId?: string | number;
  readonly packId?: string;
  readonly pageNumber?: number;
  readonly pageSize?: number;
  readonly fromDate?: Date | number;
  readonly toDate?: Date | number;
  readonly options?: Record<string, unknown>;
}

export interface GetDeliveryStatusResponse {
  readonly success: boolean;
  readonly statuses: DeliveryStatusItem[];
  readonly rawResponse?: unknown;
}

export interface GetBalanceRequest {
  readonly options?: Record<string, unknown>;
}

export interface GetBalanceResponse {
  readonly success: boolean;
  readonly balance: number;
  readonly currency?: string;
  readonly rawResponse?: unknown;
}

export interface LineItem {
  readonly lineNumber: string;
  readonly isDefault?: boolean;
  readonly type?: string;
  readonly status?: string;
}

export interface GetLinesRequest {
  readonly options?: Record<string, unknown>;
}

export interface GetLinesResponse {
  readonly success: boolean;
  readonly lines: LineItem[];
  readonly rawResponse?: unknown;
}

export interface ReceivedMessageItem {
  readonly messageId: string | number;
  readonly lineNumber: string;
  readonly mobile: string;
  readonly messageText: string;
  readonly receiveDateTime: Date;
}

export interface ReceiveMessagesRequest {
  readonly type?: 'latest' | 'live' | 'archive';
  readonly count?: number;
  readonly pageNumber?: number;
  readonly pageSize?: number;
  readonly fromDate?: Date | number;
  readonly toDate?: Date | number;
  readonly options?: Record<string, unknown>;
}

export interface ReceiveMessagesResponse {
  readonly success: boolean;
  readonly messages: ReceivedMessageItem[];
  readonly rawResponse?: unknown;
}

export interface CancelScheduledSmsRequest {
  readonly packId: string;
  readonly options?: Record<string, unknown>;
}

export interface CancelScheduledSmsResponse {
  readonly success: boolean;
  readonly returnedCreditCount?: number;
  readonly smsCount?: number;
  readonly rawResponse?: unknown;
}

export interface SmsWebhookRequest {
  readonly query: Record<string, unknown>;
  readonly body: Record<string, unknown>;
  readonly headers: Record<string, string | string[] | undefined>;
}

export interface ParsedSmsWebhookResult {
  readonly eventType: string;
  readonly messageId?: string | number;
  readonly mobile?: string;
  readonly status?: SmsStatus;
  readonly rawData: Record<string, unknown>;
}

// Capability-Based Interfaces

export interface CanSendSingleSms {
  sendSingle(request: SendSmsRequest): Promise<SendSmsResponse>;
}

export interface CanSendBulkSms {
  sendBulk(request: SendBulkSmsRequest): Promise<SendBulkSmsResponse>;
}

export interface CanSendLikeToLikeSms {
  sendLikeToLike(request: SendLikeToLikeSmsRequest): Promise<SendLikeToLikeSmsResponse>;
}

export interface CanSendPatternSms {
  sendPattern(request: SendPatternSmsRequest): Promise<SendPatternSmsResponse>;
}

export interface CanGetDeliveryStatus {
  getDeliveryStatus(request: GetDeliveryStatusRequest): Promise<GetDeliveryStatusResponse>;
}

export interface CanGetBalance {
  getBalance(request?: GetBalanceRequest): Promise<GetBalanceResponse>;
}

export interface CanGetLines {
  getLines(request?: GetLinesRequest): Promise<GetLinesResponse>;
}

export interface CanReceiveMessages {
  receiveMessages(request?: ReceiveMessagesRequest): Promise<ReceiveMessagesResponse>;
}

export interface CanCancelScheduledSms {
  cancelScheduled(request: CancelScheduledSmsRequest): Promise<CancelScheduledSmsResponse>;
}

export interface CanHandleSmsWebhook {
  parseWebhook(request: SmsWebhookRequest): Promise<ParsedSmsWebhookResult>;
}

// Base SMS Provider Contract
export interface SmsProvider {
  readonly id: string;
  readonly displayName: string;
  readonly isEnabled: boolean;
  readonly capabilities: ReadonlySet<SmsCapability>;

  supportsCapability(capability: SmsCapability): boolean;
}
