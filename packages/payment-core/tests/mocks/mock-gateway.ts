import {
  PaymentGateway,
  CanCreatePayment,
  CanVerify,
  CanInquire,
  CanRefund,
  CanReverse,
  CanHandleCallback,
  CanHandleWebhook,
  CreatePaymentRequest,
  CreatePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  InquiryPaymentRequest,
  InquiryPaymentResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  ReversePaymentRequest,
  ReversePaymentResponse,
  CallbackRequest,
  ParsedCallbackResult,
  WebhookRequest,
  ParsedWebhookResult,
} from '../../src/core/contracts/payment-gateway.interface.js';
import { GatewayCapability } from '../../src/core/domain/capabilities/gateway-capability.enum.js';
import { PaymentStatus } from '../../src/core/domain/payment/payment-status.enum.js';
import { GatewayError } from '../../src/core/errors/index.js';

export interface MockGatewayOptions {
  id?: string;
  displayName?: string;
  isEnabled?: boolean;
  shouldFailCreate?: boolean;
  shouldFailVerify?: boolean;
  shouldFailInquiry?: boolean;
  shouldFailRefund?: boolean;
  shouldFailReverse?: boolean;
}

export class MockGateway
  implements
    PaymentGateway,
    CanCreatePayment,
    CanVerify,
    CanInquire,
    CanRefund,
    CanReverse,
    CanHandleCallback,
    CanHandleWebhook
{
  public readonly id: string;
  public readonly displayName: string;
  public isEnabled: boolean;
  public readonly capabilities: ReadonlySet<GatewayCapability>;

  private options: MockGatewayOptions;

  constructor(options: MockGatewayOptions = {}) {
    this.id = options.id || 'mock_gateway';
    this.displayName = options.displayName || 'Mock Payment Gateway';
    this.isEnabled = options.isEnabled ?? true;
    this.options = options;

    this.capabilities = new Set<GatewayCapability>([
      GatewayCapability.CREATE_PAYMENT,
      GatewayCapability.VERIFY,
      GatewayCapability.INQUIRY,
      GatewayCapability.REFUND,
      GatewayCapability.REVERSE,
      GatewayCapability.CALLBACK,
      GatewayCapability.WEBHOOK,
    ]);
  }

  public supportsCapability(capability: GatewayCapability): boolean {
    return this.capabilities.has(capability);
  }

  public async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    if (this.options.shouldFailCreate) {
      throw new GatewayError('Mock create payment failed', this.id, 'MOCK_CREATE_FAILED');
    }

    const gatewayTxId = `mock_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const redirectUrl = `https://mock-gateway.example.com/pay/${gatewayTxId}`;

    return {
      success: true,
      redirectUrl,
      gatewayTransactionId: gatewayTxId,
      reference: `ref_${gatewayTxId}`,
      status: PaymentStatus.PENDING,
      metadata: { mockCreated: true, paymentId: request.payment.id },
      rawResponse: { code: 100, message: 'Mock payment created' },
    };
  }

  public async verify(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    if (this.options.shouldFailVerify) {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        gatewayTransactionId: request.gatewayTransactionId,
        metadata: { error: 'Mock verify payment failed' },
        rawResponse: { code: -100, message: 'Mock verification failed' },
      };
    }

    return {
      success: true,
      status: PaymentStatus.SUCCESS,
      reference: request.reference || `ref_verify_${request.paymentId}`,
      gatewayTransactionId: request.gatewayTransactionId || `mock_tx_verified`,
      cardMask: '603799******1234',
      metadata: { mockVerified: true, amountVerified: request.amount },
      rawResponse: { code: 100, message: 'Mock payment verified' },
    };
  }

  public async inquiry(request: InquiryPaymentRequest): Promise<InquiryPaymentResponse> {
    if (this.options.shouldFailInquiry) {
      throw new GatewayError('Mock inquiry failed', this.id, 'MOCK_INQUIRY_FAILED');
    }

    return {
      success: true,
      status: PaymentStatus.SUCCESS,
      gatewayTransactionId: request.gatewayTransactionId || 'mock_tx_inquiry',
      reference: request.reference || 'ref_inquiry',
      metadata: { mockInquiry: true },
      rawResponse: { code: 100, message: 'Mock inquiry completed' },
    };
  }

  public async refund(request: RefundPaymentRequest): Promise<RefundPaymentResponse> {
    if (this.options.shouldFailRefund) {
      throw new GatewayError('Mock refund failed', this.id, 'MOCK_REFUND_FAILED');
    }

    return {
      success: true,
      refundTransactionId: `mock_refund_${Date.now()}`,
      amountRefunded: request.amount,
      metadata: { mockRefund: true, reason: request.reason },
      rawResponse: { code: 100, message: 'Mock refund successful' },
    };
  }

  public async reverse(request: ReversePaymentRequest): Promise<ReversePaymentResponse> {
    if (this.options.shouldFailReverse) {
      throw new GatewayError('Mock reverse failed', this.id, 'MOCK_REVERSE_FAILED');
    }

    return {
      success: true,
      reverseTransactionId: `mock_reverse_${Date.now()}`,
      metadata: { mockReverse: true, reason: request.reason },
      rawResponse: { code: 100, message: 'Mock reverse successful' },
    };
  }

  public async parseCallback(request: CallbackRequest): Promise<ParsedCallbackResult> {
    const isSuccess = request.query['Authority'] ? true : Boolean(request.query['success']);
    const paymentId = request.query['paymentId'] as string | undefined;
    const gatewayTransactionId = (request.query['Authority'] || request.query['txId']) as
      string | undefined;

    return {
      paymentId,
      gatewayTransactionId,
      reference: request.query['ref'] as string | undefined,
      isSuccess,
      rawData: { ...request.query, ...request.body },
    };
  }

  public async parseWebhook(request: WebhookRequest): Promise<ParsedWebhookResult> {
    const eventType = (request.body['event'] as string) || 'payment.updated';
    const paymentId = request.body['payment_id'] as string | undefined;

    return {
      eventType,
      paymentId,
      status: PaymentStatus.SUCCESS,
      rawData: { ...request.body },
    };
  }
}
