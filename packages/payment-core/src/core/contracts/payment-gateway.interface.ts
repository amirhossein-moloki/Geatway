import { GatewayCapability } from '../domain/capabilities/gateway-capability.enum.js';
import { Payment } from '../domain/payment/payment.entity.js';
import { PaymentStatus } from '../domain/payment/payment-status.enum.js';

// Request and Response DTOs

export interface CreatePaymentRequest {
  readonly payment: Payment;
  readonly options?: Record<string, unknown>;
}

export interface CreatePaymentResponse {
  readonly success: boolean;
  readonly redirectUrl?: string;
  readonly gatewayTransactionId?: string;
  readonly reference?: string;
  readonly status: PaymentStatus;
  readonly metadata?: Record<string, unknown>;
  readonly rawResponse?: unknown;
}

export interface VerifyPaymentRequest {
  readonly paymentId: string;
  readonly amount: number;
  readonly currency: string;
  readonly gatewayTransactionId?: string;
  readonly reference?: string;
  readonly callbackData?: Record<string, unknown>;
  readonly options?: Record<string, unknown>;
}

export interface VerifyPaymentResponse {
  readonly success: boolean;
  readonly status: PaymentStatus;
  readonly reference?: string;
  readonly gatewayTransactionId?: string;
  readonly cardMask?: string;
  readonly metadata?: Record<string, unknown>;
  readonly rawResponse?: unknown;
}

export interface InquiryPaymentRequest {
  readonly paymentId: string;
  readonly gatewayTransactionId?: string;
  readonly reference?: string;
  readonly options?: Record<string, unknown>;
}

export interface InquiryPaymentResponse {
  readonly success: boolean;
  readonly status: PaymentStatus;
  readonly amount?: number;
  readonly reference?: string;
  readonly gatewayTransactionId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly rawResponse?: unknown;
}

export interface RefundPaymentRequest {
  readonly paymentId: string;
  readonly amount: number;
  readonly currency: string;
  readonly gatewayTransactionId?: string;
  readonly reason?: string;
  readonly options?: Record<string, unknown>;
}

export interface RefundPaymentResponse {
  readonly success: boolean;
  readonly refundTransactionId?: string;
  readonly amountRefunded: number;
  readonly metadata?: Record<string, unknown>;
  readonly rawResponse?: unknown;
}

export interface ReversePaymentRequest {
  readonly paymentId: string;
  readonly gatewayTransactionId?: string;
  readonly reason?: string;
  readonly options?: Record<string, unknown>;
}

export interface ReversePaymentResponse {
  readonly success: boolean;
  readonly reverseTransactionId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly rawResponse?: unknown;
}

export interface CallbackRequest {
  readonly query: Record<string, unknown>;
  readonly body: Record<string, unknown>;
  readonly headers: Record<string, string | string[] | undefined>;
}

export interface ParsedCallbackResult {
  readonly paymentId?: string;
  readonly gatewayTransactionId?: string;
  readonly reference?: string;
  readonly isSuccess: boolean;
  readonly rawData: Record<string, unknown>;
}

export interface WebhookRequest {
  readonly query: Record<string, unknown>;
  readonly body: Record<string, unknown>;
  readonly headers: Record<string, string | string[] | undefined>;
}

export interface ParsedWebhookResult {
  readonly eventType: string;
  readonly paymentId?: string;
  readonly gatewayTransactionId?: string;
  readonly status?: PaymentStatus;
  readonly rawData: Record<string, unknown>;
}

// Capability-based Interfaces

export interface CanCreatePayment {
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;
}

export interface CanVerify {
  verify(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse>;
}

export interface CanInquire {
  inquiry(request: InquiryPaymentRequest): Promise<InquiryPaymentResponse>;
}

export interface CanRefund {
  refund(request: RefundPaymentRequest): Promise<RefundPaymentResponse>;
}

export interface CanReverse {
  reverse(request: ReversePaymentRequest): Promise<ReversePaymentResponse>;
}

export interface CanHandleCallback {
  parseCallback(request: CallbackRequest): Promise<ParsedCallbackResult>;
}

export interface CanHandleWebhook {
  parseWebhook(request: WebhookRequest): Promise<ParsedWebhookResult>;
}

// Base Gateway Contract
export interface PaymentGateway {
  readonly id: string;
  readonly displayName: string;
  readonly isEnabled: boolean;
  readonly capabilities: ReadonlySet<GatewayCapability>;

  supportsCapability(capability: GatewayCapability): boolean;
}
