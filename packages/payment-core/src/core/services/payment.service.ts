import { GatewayRegistry } from '../registry/gateway.registry.js';
import { Payment } from '../domain/payment/payment.entity.js';
import { PaymentStatus } from '../domain/payment/payment-status.enum.js';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../domain/transaction/transaction.entity.js';
import { GatewayCapability } from '../domain/capabilities/gateway-capability.enum.js';
import {
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
  CreatePaymentResponse,
  AuthorizePaymentResponse,
  CapturePaymentResponse,
  CancelPaymentResponse,
  VerifyPaymentResponse,
  InquiryPaymentResponse,
  RefundPaymentResponse,
  ReversePaymentResponse,
  CapturePaymentRequest,
  CancelPaymentRequest,
  VerifyPaymentRequest,
  InquiryPaymentRequest,
  RefundPaymentRequest,
  ReversePaymentRequest,
  CallbackRequest,
  ParsedCallbackResult,
  WebhookRequest,
  ParsedWebhookResult,
} from '../contracts/payment-gateway.interface.js';
import { UnsupportedCapabilityError, ValidationError } from '../errors/index.js';

export class PaymentService {
  constructor(private readonly gatewayRegistry: GatewayRegistry) {}

  public async createPayment(
    payment: Payment,
    options?: Record<string, unknown>,
  ): Promise<{ payment: Payment; response: CreatePaymentResponse; transaction: Transaction }> {
    if (!payment.gateway) {
      throw new ValidationError('Gateway must be specified on payment entity');
    }

    const gateway = this.gatewayRegistry.getActiveGateway(
      payment.gateway,
      GatewayCapability.CREATE_PAYMENT,
    );

    const createCapableGateway = gateway as unknown as CanCreatePayment;
    if (typeof createCapableGateway.createPayment !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.CREATE_PAYMENT);
    }

    const response = await createCapableGateway.createPayment({
      payment,
      options,
    });

    if (response.success) {
      payment.transitionTo(response.status || PaymentStatus.PENDING);
    } else {
      payment.transitionTo(PaymentStatus.FAILED);
    }

    const transaction = new Transaction({
      paymentId: payment.id,
      gateway: payment.gateway,
      type: TransactionType.PAYMENT,
      status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
      amount: payment.amount,
      reference: response.reference,
      gatewayTransactionId: response.gatewayTransactionId,
      metadata: response.metadata,
    });

    return { payment, response, transaction };
  }

  public async verifyPayment(
    payment: Payment,
    request: Omit<VerifyPaymentRequest, 'paymentId' | 'amount' | 'currency'>,
  ): Promise<{ payment: Payment; response: VerifyPaymentResponse; transaction: Transaction }> {
    if (!payment.gateway) {
      throw new ValidationError('Gateway must be specified on payment entity');
    }

    const gateway = this.gatewayRegistry.getActiveGateway(
      payment.gateway,
      GatewayCapability.VERIFY,
    );

    const verifyCapableGateway = gateway as unknown as CanVerify;
    if (typeof verifyCapableGateway.verify !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.VERIFY);
    }

    const response = await verifyCapableGateway.verify({
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      ...request,
    });

    if (response.success) {
      payment.transitionTo(PaymentStatus.SUCCESS);
    } else {
      payment.transitionTo(PaymentStatus.FAILED);
    }

    const transaction = new Transaction({
      paymentId: payment.id,
      gateway: payment.gateway,
      type: TransactionType.VERIFY,
      status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
      amount: payment.amount,
      reference: response.reference,
      gatewayTransactionId: response.gatewayTransactionId,
      metadata: response.metadata,
    });

    return { payment, response, transaction };
  }

  public async inquiryPayment(
    payment: Payment,
    request?: Omit<InquiryPaymentRequest, 'paymentId'>,
  ): Promise<{ payment: Payment; response: InquiryPaymentResponse; transaction: Transaction }> {
    if (!payment.gateway) {
      throw new ValidationError('Gateway must be specified on payment entity');
    }

    const gateway = this.gatewayRegistry.getActiveGateway(
      payment.gateway,
      GatewayCapability.INQUIRY,
    );

    const inquiryCapableGateway = gateway as unknown as CanInquire;
    if (typeof inquiryCapableGateway.inquiry !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.INQUIRY);
    }

    const response = await inquiryCapableGateway.inquiry({
      paymentId: payment.id,
      ...request,
    });

    if (response.success && response.status) {
      if (response.status !== payment.status) {
        payment.transitionTo(response.status);
      }
    }

    const transaction = new Transaction({
      paymentId: payment.id,
      gateway: payment.gateway,
      type: TransactionType.INQUIRY,
      status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
      amount: response.amount ?? payment.amount,
      reference: response.reference,
      gatewayTransactionId: response.gatewayTransactionId,
      metadata: response.metadata,
    });

    return { payment, response, transaction };
  }

  public async authorizePayment(
    payment: Payment,
    options?: Record<string, unknown>,
  ): Promise<{ payment: Payment; response: AuthorizePaymentResponse; transaction: Transaction }> {
    if (!payment.gateway) {
      throw new ValidationError('Gateway must be specified on payment entity');
    }

    const gateway = this.gatewayRegistry.getActiveGateway(
      payment.gateway,
      GatewayCapability.AUTHORIZE,
    );

    const authorizeCapableGateway = gateway as unknown as CanAuthorize;
    if (typeof authorizeCapableGateway.authorize !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.AUTHORIZE);
    }

    const response = await authorizeCapableGateway.authorize({
      payment,
      options,
    });

    if (response.success) {
      payment.transitionTo(response.status || PaymentStatus.AUTHORIZED);
    } else {
      payment.transitionTo(PaymentStatus.FAILED);
    }

    const transaction = new Transaction({
      paymentId: payment.id,
      gateway: payment.gateway,
      type: TransactionType.AUTHORIZATION,
      status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
      amount: payment.amount,
      reference: response.reference,
      gatewayTransactionId: response.gatewayTransactionId,
      metadata: response.metadata,
    });

    return { payment, response, transaction };
  }

  public async capturePayment(
    payment: Payment,
    request?: Omit<CapturePaymentRequest, 'paymentId' | 'amount' | 'currency'> & { amount?: number },
  ): Promise<{ payment: Payment; response: CapturePaymentResponse; transaction: Transaction }> {
    if (!payment.gateway) {
      throw new ValidationError('Gateway must be specified on payment entity');
    }

    const gateway = this.gatewayRegistry.getActiveGateway(
      payment.gateway,
      GatewayCapability.CAPTURE,
    );

    const captureCapableGateway = gateway as unknown as CanCapture;
    if (typeof captureCapableGateway.capture !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.CAPTURE);
    }

    const captureAmount = request?.amount ?? payment.amount;

    const response = await captureCapableGateway.capture({
      paymentId: payment.id,
      amount: captureAmount,
      currency: payment.currency,
      ...request,
    });

    if (response.success) {
      payment.transitionTo(response.status || PaymentStatus.SUCCESS);
    } else {
      payment.transitionTo(PaymentStatus.FAILED);
    }

    const transaction = new Transaction({
      paymentId: payment.id,
      gateway: payment.gateway,
      type: TransactionType.CAPTURE,
      status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
      amount: response.amountCaptured || captureAmount,
      gatewayTransactionId: response.captureTransactionId,
      metadata: response.metadata,
    });

    return { payment, response, transaction };
  }

  public async cancelPayment(
    payment: Payment,
    request?: Omit<CancelPaymentRequest, 'paymentId'>,
  ): Promise<{ payment: Payment; response: CancelPaymentResponse; transaction: Transaction }> {
    if (!payment.gateway) {
      throw new ValidationError('Gateway must be specified on payment entity');
    }

    const gateway = this.gatewayRegistry.getActiveGateway(
      payment.gateway,
      GatewayCapability.CANCEL,
    );

    const cancelCapableGateway = gateway as unknown as CanCancel;
    if (typeof cancelCapableGateway.cancel !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.CANCEL);
    }

    const response = await cancelCapableGateway.cancel({
      paymentId: payment.id,
      ...request,
    });

    if (response.success) {
      payment.transitionTo(PaymentStatus.CANCELLED);
    }

    const transaction = new Transaction({
      paymentId: payment.id,
      gateway: payment.gateway,
      type: TransactionType.CANCEL,
      status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
      amount: payment.amount,
      gatewayTransactionId: response.cancelTransactionId,
      metadata: response.metadata,
    });

    return { payment, response, transaction };
  }

  public async refundPayment(
    payment: Payment,
    request: Omit<RefundPaymentRequest, 'paymentId' | 'amount' | 'currency'> & { amount?: number },
  ): Promise<{ payment: Payment; response: RefundPaymentResponse; transaction: Transaction }> {
    if (!payment.gateway) {
      throw new ValidationError('Gateway must be specified on payment entity');
    }

    const gateway = this.gatewayRegistry.getActiveGateway(
      payment.gateway,
      GatewayCapability.REFUND,
    );

    const refundCapableGateway = gateway as unknown as CanRefund;
    if (typeof refundCapableGateway.refund !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.REFUND);
    }

    const refundAmount = request.amount ?? payment.amount;

    const response = await refundCapableGateway.refund({
      paymentId: payment.id,
      amount: refundAmount,
      currency: payment.currency,
      ...request,
    });

    if (response.success) {
      const isPartial = response.amountRefunded < payment.amount;
      payment.transitionTo(isPartial ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED);
    }

    const transaction = new Transaction({
      paymentId: payment.id,
      gateway: payment.gateway,
      type: TransactionType.REFUND,
      status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
      amount: refundAmount,
      gatewayTransactionId: response.refundTransactionId,
      metadata: response.metadata,
    });

    return { payment, response, transaction };
  }

  public async parseCallback(
    gatewayId: string,
    request: CallbackRequest,
  ): Promise<ParsedCallbackResult> {
    const gateway = this.gatewayRegistry.getActiveGateway(
      gatewayId,
      GatewayCapability.CALLBACK,
    );

    const callbackCapableGateway = gateway as unknown as CanHandleCallback;
    if (typeof callbackCapableGateway.parseCallback !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.CALLBACK);
    }

    return callbackCapableGateway.parseCallback(request);
  }

  public async parseWebhook(
    gatewayId: string,
    request: WebhookRequest,
  ): Promise<ParsedWebhookResult> {
    const gateway = this.gatewayRegistry.getActiveGateway(
      gatewayId,
      GatewayCapability.WEBHOOK,
    );

    const webhookCapableGateway = gateway as unknown as CanHandleWebhook;
    if (typeof webhookCapableGateway.parseWebhook !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.WEBHOOK);
    }

    return webhookCapableGateway.parseWebhook(request);
  }

  public async reversePayment(
    payment: Payment,
    request?: Omit<ReversePaymentRequest, 'paymentId'>,
  ): Promise<{ payment: Payment; response: ReversePaymentResponse; transaction: Transaction }> {
    if (!payment.gateway) {
      throw new ValidationError('Gateway must be specified on payment entity');
    }

    const gateway = this.gatewayRegistry.getActiveGateway(
      payment.gateway,
      GatewayCapability.REVERSE,
    );

    const reverseCapableGateway = gateway as unknown as CanReverse;
    if (typeof reverseCapableGateway.reverse !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.REVERSE);
    }

    const response = await reverseCapableGateway.reverse({
      paymentId: payment.id,
      ...request,
    });

    if (response.success) {
      payment.transitionTo(PaymentStatus.REVERSED);
    }

    const transaction = new Transaction({
      paymentId: payment.id,
      gateway: payment.gateway,
      type: TransactionType.REVERSE,
      status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
      amount: payment.amount,
      gatewayTransactionId: response.reverseTransactionId,
      metadata: response.metadata,
    });

    return { payment, response, transaction };
  }
}
