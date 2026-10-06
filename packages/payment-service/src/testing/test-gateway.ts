import {
  PaymentGateway,
  GatewayCapability,
  CanCreatePayment,
  CanAuthorize,
  CanCapture,
  CanCancel,
  CanVerify,
  CanInquire,
  CanRefund,
  CanReverse,
  CanHandleCallback,
  CanHandleWebhook,
  CreatePaymentRequest,
  CreatePaymentResponse,
  AuthorizePaymentRequest,
  AuthorizePaymentResponse,
  CapturePaymentRequest,
  CapturePaymentResponse,
  CancelPaymentRequest,
  CancelPaymentResponse,
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
  PaymentStatus,
  GatewayError,
} from '@company/payment-core';

export class TestGateway
  implements
    PaymentGateway,
    CanCreatePayment,
    CanAuthorize,
    CanCapture,
    CanCancel,
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
  public capabilities: Set<GatewayCapability>;

  public shouldFail = false;
  public failureMessage = 'Simulated Gateway Error';
  public callCount: Record<string, number> = {};

  constructor(id = 'test-gateway', displayName = 'Test Payment Gateway') {
    this.id = id;
    this.displayName = displayName;
    this.isEnabled = true;
    this.capabilities = new Set([
      GatewayCapability.CREATE_PAYMENT,
      GatewayCapability.AUTHORIZE,
      GatewayCapability.CAPTURE,
      GatewayCapability.CANCEL,
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

  private recordCall(method: string): void {
    this.callCount[method] = (this.callCount[method] || 0) + 1;
  }

  public async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    this.recordCall('createPayment');
    if (this.shouldFail) {
      throw new GatewayError(this.failureMessage, this.id);
    }
    return {
      success: true,
      status: PaymentStatus.PENDING,
      redirectUrl: `https://test-gateway.com/pay/${request.payment.id}`,
      gatewayTransactionId: `gtx_${request.payment.id}`,
      reference: `ref_${request.payment.id}`,
    };
  }

  public async authorize(request: AuthorizePaymentRequest): Promise<AuthorizePaymentResponse> {
    this.recordCall('authorize');
    if (this.shouldFail) {
      throw new GatewayError(this.failureMessage, this.id);
    }
    return {
      success: true,
      status: PaymentStatus.AUTHORIZED,
      gatewayTransactionId: `auth_${request.payment.id}`,
      reference: `ref_${request.payment.id}`,
    };
  }

  public async capture(request: CapturePaymentRequest): Promise<CapturePaymentResponse> {
    this.recordCall('capture');
    if (this.shouldFail) {
      throw new GatewayError(this.failureMessage, this.id);
    }
    return {
      success: true,
      status: PaymentStatus.SUCCESS,
      amountCaptured: request.amount,
      captureTransactionId: `cap_${request.paymentId}`,
    };
  }

  public async cancel(request: CancelPaymentRequest): Promise<CancelPaymentResponse> {
    this.recordCall('cancel');
    if (this.shouldFail) {
      throw new GatewayError(this.failureMessage, this.id);
    }
    return {
      success: true,
      cancelTransactionId: `cnl_${request.paymentId}`,
    };
  }

  public async verify(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    this.recordCall('verify');
    if (this.shouldFail) {
      throw new GatewayError(this.failureMessage, this.id);
    }
    return {
      success: true,
      status: PaymentStatus.SUCCESS,
      reference: request.reference || `ref_v_${request.paymentId}`,
      gatewayTransactionId: request.gatewayTransactionId || `gtx_v_${request.paymentId}`,
      cardMask: '603799******1234',
    };
  }

  public async inquiry(request: InquiryPaymentRequest): Promise<InquiryPaymentResponse> {
    this.recordCall('inquiry');
    if (this.shouldFail) {
      throw new GatewayError(this.failureMessage, this.id);
    }
    return {
      success: true,
      status: PaymentStatus.SUCCESS,
      gatewayTransactionId: request.gatewayTransactionId || `gtx_inq_${request.paymentId}`,
      reference: request.reference || `ref_inq_${request.paymentId}`,
    };
  }

  public async refund(request: RefundPaymentRequest): Promise<RefundPaymentResponse> {
    this.recordCall('refund');
    if (this.shouldFail) {
      throw new GatewayError(this.failureMessage, this.id);
    }
    return {
      success: true,
      amountRefunded: request.amount,
      refundTransactionId: `ref_tx_${request.paymentId}`,
    };
  }

  public async reverse(request: ReversePaymentRequest): Promise<ReversePaymentResponse> {
    this.recordCall('reverse');
    if (this.shouldFail) {
      throw new GatewayError(this.failureMessage, this.id);
    }
    return {
      success: true,
      reverseTransactionId: `rev_tx_${request.paymentId}`,
    };
  }

  public async parseCallback(request: CallbackRequest): Promise<ParsedCallbackResult> {
    this.recordCall('parseCallback');
    const paymentId =
      (request.query['paymentId'] as string) || (request.body['paymentId'] as string);
    const success = request.query['status'] === 'OK' || request.body['status'] === 'OK';
    return {
      paymentId,
      gatewayTransactionId: (request.query['gtx'] as string) || (request.body['gtx'] as string),
      reference: (request.query['ref'] as string) || (request.body['ref'] as string),
      isSuccess: success,
      rawData: { ...request.query, ...request.body },
    };
  }

  public async parseWebhook(request: WebhookRequest): Promise<ParsedWebhookResult> {
    this.recordCall('parseWebhook');
    const body = request.body || {};
    return {
      eventType: (body['event'] as string) || 'payment.succeeded',
      paymentId: body['paymentId'] as string,
      gatewayTransactionId: body['gatewayTransactionId'] as string,
      status: (body['status'] as PaymentStatus) || PaymentStatus.SUCCESS,
      rawData: body,
    };
  }
}
