import { GatewayCapability, PaymentStatus } from '../domain/enums';

export interface CreatePaymentRequest {
  readonly paymentId: string;
  readonly amount: number;
  readonly currency: string;
  readonly callbackUrl: string;
  readonly description?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface CreatePaymentResponse {
  readonly success: boolean;
  readonly gatewayTransactionId?: string | undefined;
  readonly redirectUrl?: string | undefined;
  readonly actionType?: 'REDIRECT' | 'FORM' | 'NONE' | undefined;
  readonly rawResponse?: Readonly<Record<string, unknown>> | undefined;
}

export interface VerifyPaymentRequest {
  readonly paymentId: string;
  readonly amount: number;
  readonly gatewayTransactionId?: string | undefined;
  readonly reference?: string | undefined;
  readonly callbackData?: Readonly<Record<string, unknown>> | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface VerifyPaymentResponse {
  readonly success: boolean;
  readonly status: PaymentStatus;
  readonly reference?: string | undefined;
  readonly gatewayTransactionId?: string | undefined;
  readonly rawResponse?: Readonly<Record<string, unknown>> | undefined;
}

export interface InquiryPaymentRequest {
  readonly paymentId: string;
  readonly gatewayTransactionId?: string | undefined;
}

export interface InquiryPaymentResponse {
  readonly status: PaymentStatus;
  readonly reference?: string | undefined;
  readonly amount?: number | undefined;
  readonly rawResponse?: Readonly<Record<string, unknown>> | undefined;
}

export interface RefundPaymentRequest {
  readonly paymentId: string;
  readonly amount: number;
  readonly reason?: string | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface RefundPaymentResponse {
  readonly success: boolean;
  readonly refundReference?: string | undefined;
  readonly rawResponse?: Readonly<Record<string, unknown>> | undefined;
}

export interface ReversePaymentRequest {
  readonly paymentId: string;
  readonly reason?: string | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface ReversePaymentResponse {
  readonly success: boolean;
  readonly reversalReference?: string | undefined;
  readonly rawResponse?: Readonly<Record<string, unknown>> | undefined;
}

export interface CallbackHandlingRequest {
  readonly query: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

export interface CallbackHandlingResponse {
  readonly paymentId?: string | undefined;
  readonly gatewayTransactionId?: string | undefined;
  readonly isSuccess: boolean;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface WebhookHandlingRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: unknown;
  readonly rawBody?: string | undefined;
}

export interface WebhookHandlingResponse {
  readonly paymentId?: string | undefined;
  readonly eventType: string;
  readonly isHandled: boolean;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface BaseGateway {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly capabilities: ReadonlySet<GatewayCapability>;
}

export interface CanCreatePayment {
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;
}

export interface CanVerifyPayment {
  verify(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse>;
}

export interface CanInquirePayment {
  inquiry(request: InquiryPaymentRequest): Promise<InquiryPaymentResponse>;
}

export interface CanRefundPayment {
  refund(request: RefundPaymentRequest): Promise<RefundPaymentResponse>;
}

export interface CanReversePayment {
  reverse(request: ReversePaymentRequest): Promise<ReversePaymentResponse>;
}

export interface CanHandleCallback {
  handleCallback(request: CallbackHandlingRequest): Promise<CallbackHandlingResponse>;
}

export interface CanHandleWebhook {
  handleWebhook(request: WebhookHandlingRequest): Promise<WebhookHandlingResponse>;
}

export type PaymentGateway = BaseGateway &
  Partial<CanCreatePayment> &
  Partial<CanVerifyPayment> &
  Partial<CanInquirePayment> &
  Partial<CanRefundPayment> &
  Partial<CanReversePayment> &
  Partial<CanHandleCallback> &
  Partial<CanHandleWebhook>;
