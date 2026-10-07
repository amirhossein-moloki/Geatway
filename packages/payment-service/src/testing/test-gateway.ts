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
} from '@amirhossein-moloki/payment-core';

export type MockGatewayScenario =
  | 'success'
  | 'declined'
  | 'timeout'
  | 'network-error'
  | 'provider-error'
  | 'invalid-state'
  | 'customer-action-required'
  | 'pending';

export interface TestGatewayOptions {
  id?: string;
  displayName?: string;
  scenario?: MockGatewayScenario;
  shouldFail?: boolean;
  failureMessage?: string;
  simulatedDelayMs?: number;
}

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

  public scenario: MockGatewayScenario = 'success';
  public shouldFail = false;
  public failureMessage = 'Simulated Gateway Error';
  public simulatedDelayMs = 0;
  public callCount: Record<string, number> = {};

  constructor(
    idOrOptions: string | TestGatewayOptions = 'test-gateway',
    displayName = 'Test Payment Gateway',
  ) {
    if (typeof idOrOptions === 'object') {
      this.id = idOrOptions.id || 'test-gateway';
      this.displayName = idOrOptions.displayName || 'Test Payment Gateway';
      this.scenario = idOrOptions.scenario || 'success';
      this.shouldFail = idOrOptions.shouldFail ?? false;
      this.failureMessage = idOrOptions.failureMessage || 'Simulated Gateway Error';
      this.simulatedDelayMs = idOrOptions.simulatedDelayMs || 0;
    } else {
      this.id = idOrOptions;
      this.displayName = displayName;
    }

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

  private async handleSimulation(method: string): Promise<void> {
    this.callCount[method] = (this.callCount[method] || 0) + 1;

    if (this.simulatedDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedDelayMs));
    }

    if (this.shouldFail) {
      throw new GatewayError(this.failureMessage, this.id, 'SIMULATED_FAILURE');
    }

    switch (this.scenario) {
      case 'declined':
        throw new GatewayError('Card declined by issuer', this.id, 'CARD_DECLINED');
      case 'timeout':
        throw new GatewayError('Gateway request timed out', this.id, 'REQUEST_TIMEOUT');
      case 'network-error':
        throw new GatewayError('Network connection failed', this.id, 'ECONNREFUSED');
      case 'provider-error':
        throw new GatewayError('Internal provider error', this.id, 'PROVIDER_ERROR');
      case 'invalid-state':
        throw new GatewayError('Operation invalid for current state', this.id, 'INVALID_STATE');
      case 'success':
      case 'customer-action-required':
      case 'pending':
      default:
        break;
    }
  }

  public async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    await this.handleSimulation('createPayment');

    if (this.scenario === 'customer-action-required') {
      return {
        success: true,
        status: PaymentStatus.PENDING,
        redirectUrl: `https://test-gateway.com/action/${request.payment.id}`,
        gatewayTransactionId: `gtx_${request.payment.id}`,
        reference: `ref_${request.payment.id}`,
      };
    }

    if (this.scenario === 'pending') {
      return {
        success: true,
        status: PaymentStatus.PENDING,
        redirectUrl: `https://test-gateway.com/pay/${request.payment.id}`,
        gatewayTransactionId: `gtx_${request.payment.id}`,
        reference: `ref_${request.payment.id}`,
      };
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
    await this.handleSimulation('authorize');
    return {
      success: true,
      status: PaymentStatus.AUTHORIZED,
      gatewayTransactionId: `auth_${request.payment.id}`,
      reference: `ref_${request.payment.id}`,
    };
  }

  public async capture(request: CapturePaymentRequest): Promise<CapturePaymentResponse> {
    await this.handleSimulation('capture');
    return {
      success: true,
      status: PaymentStatus.SUCCESS,
      amountCaptured: request.amount,
      captureTransactionId: `cap_${request.paymentId}`,
    };
  }

  public async cancel(request: CancelPaymentRequest): Promise<CancelPaymentResponse> {
    await this.handleSimulation('cancel');
    return {
      success: true,
      cancelTransactionId: `cnl_${request.paymentId}`,
    };
  }

  public async verify(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    await this.handleSimulation('verify');

    if (this.scenario === 'pending') {
      return {
        success: false,
        status: PaymentStatus.PENDING,
        reference: request.reference || `ref_v_${request.paymentId}`,
        gatewayTransactionId: request.gatewayTransactionId || `gtx_v_${request.paymentId}`,
      };
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
    await this.handleSimulation('inquiry');

    if (this.scenario === 'pending') {
      return {
        success: true,
        status: PaymentStatus.PENDING,
        gatewayTransactionId: request.gatewayTransactionId || `gtx_inq_${request.paymentId}`,
        reference: request.reference || `ref_inq_${request.paymentId}`,
      };
    }

    return {
      success: true,
      status: PaymentStatus.SUCCESS,
      gatewayTransactionId: request.gatewayTransactionId || `gtx_inq_${request.paymentId}`,
      reference: request.reference || `ref_inq_${request.paymentId}`,
    };
  }

  public async refund(request: RefundPaymentRequest): Promise<RefundPaymentResponse> {
    await this.handleSimulation('refund');
    return {
      success: true,
      amountRefunded: request.amount,
      refundTransactionId: `ref_tx_${request.paymentId}`,
    };
  }

  public async reverse(request: ReversePaymentRequest): Promise<ReversePaymentResponse> {
    await this.handleSimulation('reverse');
    return {
      success: true,
      reverseTransactionId: `rev_tx_${request.paymentId}`,
    };
  }

  public async parseCallback(request: CallbackRequest): Promise<ParsedCallbackResult> {
    this.callCount['parseCallback'] = (this.callCount['parseCallback'] || 0) + 1;
    const paymentId =
      (request.query['paymentId'] as string) || (request.body['paymentId'] as string);
    const success =
      this.scenario === 'declined'
        ? false
        : request.query['status'] === 'OK' || request.body['status'] === 'OK';
    return {
      paymentId,
      gatewayTransactionId: (request.query['gtx'] as string) || (request.body['gtx'] as string),
      reference: (request.query['ref'] as string) || (request.body['ref'] as string),
      isSuccess: success,
      rawData: { ...request.query, ...request.body },
    };
  }

  public async parseWebhook(request: WebhookRequest): Promise<ParsedWebhookResult> {
    this.callCount['parseWebhook'] = (this.callCount['parseWebhook'] || 0) + 1;
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

export class MockGateway extends TestGateway {}
