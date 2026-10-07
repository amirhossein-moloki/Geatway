import { createHash, randomUUID } from 'crypto';
import {
  GatewayRegistry,
  GatewayCapability,
  PaymentRepository,
  TransactionRepository,
  IdempotencyRepository,
  WebhookEventRepository,
  Payment,
  PaymentStatus,
  Transaction,
  TransactionType,
  TransactionStatus,
  CanCreatePayment,
  CanInquire,
  CanVerify,
  CanAuthorize,
  CanCapture,
  CanRefund,
  CanCancel,
  CanReverse,
  CanHandleCallback,
  CanHandleWebhook,
  CreatePaymentResponse,
  InquiryPaymentResponse,
  VerifyPaymentResponse,
  AuthorizePaymentResponse,
  CapturePaymentResponse,
  RefundPaymentResponse,
  CancelPaymentResponse,
  ReversePaymentResponse,
  CallbackRequest,
  WebhookRequest,
  WebhookEvent,
  WebhookEventStatus,
  ValidationError,
  RepositoryNotFoundError,
  UnsupportedCapabilityError,
  InvalidPaymentStateError,
} from '@amirhossein-moloki/payment-core';

import { PaymentServiceConfig, Clock, SystemClock } from './configuration.js';
import { PaymentLogger, NoopLogger } from './observability/logger.js';
import { RetryPolicy } from './policies/retry-policy.js';
import { TimeoutPolicy } from './policies/timeout-policy.js';
import { IdempotencyOrchestrator } from './idempotency/idempotency-orchestrator.js';

export interface PaymentApplicationServiceDependencies {
  registry: GatewayRegistry;
  paymentRepository: PaymentRepository;
  transactionRepository: TransactionRepository;
  idempotencyRepository?: IdempotencyRepository;
  webhookEventRepository?: WebhookEventRepository;
  logger?: PaymentLogger;
  clock?: Clock;
  config?: PaymentServiceConfig;
}

export interface CreatePaymentInput {
  gateway: string;
  amount: number;
  currency: string;
  callbackUrl?: string;
  returnUrl?: string;
  description?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  options?: Record<string, unknown>;
}

export interface CreatePaymentOutput {
  payment: Payment;
  transaction: Transaction;
  status: PaymentStatus;
  redirectUrl?: string;
  actionUrl?: string;
  action?: Record<string, unknown>;
  reference?: string;
  gatewayTransactionId?: string;
  rawResponse?: unknown;
}

export interface InquirePaymentOutput {
  payment: Payment;
  transaction: Transaction;
  status: PaymentStatus;
  reference?: string;
  gatewayTransactionId?: string;
  amount?: number;
  rawResponse?: unknown;
}

export interface VerifyPaymentInput {
  paymentId?: string;
  gatewayTransactionId?: string;
  reference?: string;
  callbackData?: Record<string, unknown>;
  idempotencyKey?: string;
  options?: Record<string, unknown>;
}

export interface VerifyPaymentOutput {
  payment: Payment;
  transaction: Transaction;
  status: PaymentStatus;
  reference?: string;
  gatewayTransactionId?: string;
  cardMask?: string;
  rawResponse?: unknown;
}

export interface AuthorizePaymentInput {
  gateway: string;
  amount: number;
  currency: string;
  callbackUrl?: string;
  description?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  options?: Record<string, unknown>;
}

export interface AuthorizePaymentOutput {
  payment: Payment;
  transaction: Transaction;
  status: PaymentStatus;
  redirectUrl?: string;
  actionUrl?: string;
  reference?: string;
  gatewayTransactionId?: string;
  rawResponse?: unknown;
}

export interface CapturePaymentInput {
  paymentId: string;
  amount?: number;
  idempotencyKey?: string;
  options?: Record<string, unknown>;
}

export interface CapturePaymentOutput {
  payment: Payment;
  transaction: Transaction;
  status: PaymentStatus;
  amountCaptured: number;
  captureTransactionId?: string;
  rawResponse?: unknown;
}

export interface RefundPaymentInput {
  paymentId: string;
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
  options?: Record<string, unknown>;
}

export interface RefundPaymentOutput {
  payment: Payment;
  transaction: Transaction;
  status: PaymentStatus;
  amountRefunded: number;
  refundTransactionId?: string;
  rawResponse?: unknown;
}

export interface CancelPaymentInput {
  paymentId: string;
  reason?: string;
  idempotencyKey?: string;
  options?: Record<string, unknown>;
}

export interface CancelPaymentOutput {
  payment: Payment;
  transaction: Transaction;
  status: PaymentStatus;
  cancelTransactionId?: string;
  rawResponse?: unknown;
}

export interface ReversePaymentInput {
  paymentId: string;
  reason?: string;
  idempotencyKey?: string;
  options?: Record<string, unknown>;
}

export interface ReversePaymentOutput {
  payment: Payment;
  transaction: Transaction;
  status: PaymentStatus;
  reverseTransactionId?: string;
  rawResponse?: unknown;
}

export interface CallbackProcessingOutput {
  payment?: Payment;
  isSuccess: boolean;
  paymentId?: string;
  gatewayTransactionId?: string;
  reference?: string;
  rawData: Record<string, unknown>;
}

export interface WebhookProcessingOutput {
  webhookEvent: WebhookEvent;
  payment?: Payment;
  eventType: string;
  isDuplicate: boolean;
}

export class PaymentApplicationService {
  private readonly registry: GatewayRegistry;
  private readonly paymentRepo: PaymentRepository;
  private readonly transactionRepo: TransactionRepository;
  private readonly webhookRepo?: WebhookEventRepository;
  private readonly logger: PaymentLogger;
  private readonly clock: Clock;
  private readonly config: PaymentServiceConfig;
  private readonly retryPolicy: RetryPolicy;
  private readonly idempotencyOrchestrator: IdempotencyOrchestrator;

  constructor(deps: PaymentApplicationServiceDependencies) {
    if (!deps.registry) {
      throw new ValidationError('GatewayRegistry is required for PaymentApplicationService');
    }
    if (!deps.paymentRepository) {
      throw new ValidationError('PaymentRepository is required for PaymentApplicationService');
    }
    if (!deps.transactionRepository) {
      throw new ValidationError('TransactionRepository is required for PaymentApplicationService');
    }

    this.registry = deps.registry;
    this.paymentRepo = deps.paymentRepository;
    this.transactionRepo = deps.transactionRepository;
    this.webhookRepo = deps.webhookEventRepository;
    this.logger = deps.logger || new NoopLogger();
    this.clock = deps.clock || new SystemClock();
    this.config = deps.config || {};

    this.retryPolicy = new RetryPolicy(this.config.retryPolicy);
    this.idempotencyOrchestrator = new IdempotencyOrchestrator(deps.idempotencyRepository);
  }

  public async createPayment(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
    this.logger.info?.('Creating payment', {
      gateway: input.gateway,
      amount: input.amount,
      currency: input.currency,
    });

    if (!input.gateway) {
      throw new ValidationError('Gateway identifier is required');
    }
    if (!input.amount || input.amount <= 0) {
      throw new ValidationError('Payment amount must be greater than 0');
    }
    if (!input.currency) {
      throw new ValidationError('Payment currency is required');
    }

    const gateway = this.registry.getActiveGateway(input.gateway, GatewayCapability.CREATE_PAYMENT);

    const createCapableGateway = gateway as unknown as CanCreatePayment;
    if (typeof createCapableGateway.createPayment !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.CREATE_PAYMENT);
    }

    const scope = `create_payment:${input.gateway}`;
    const key = input.idempotencyKey;

    return this.idempotencyOrchestrator.executeIdempotent<CreatePaymentOutput>(
      scope,
      key,
      input,
      async () => {
        const callbackUrl = input.callbackUrl || input.returnUrl;

        const payment = new Payment({
          amount: input.amount,
          currency: input.currency,
          gateway: input.gateway,
          callbackUrl,
          description: input.description,
          projectId: input.projectId,
          metadata: input.metadata,
          idempotencyKey: input.idempotencyKey,
          status: PaymentStatus.CREATED,
        });

        await this.paymentRepo.create(payment);

        const response: CreatePaymentResponse = await this.retryPolicy.execute(() =>
          TimeoutPolicy.withTimeout(
            createCapableGateway.createPayment({
              payment,
              options: input.options,
            }),
            this.config.defaultTimeoutMs ?? 0,
            `CreatePayment (${input.gateway})`,
          ),
        );

        if (response.success) {
          payment.transitionTo(response.status || PaymentStatus.PENDING);
        } else {
          payment.transitionTo(PaymentStatus.FAILED);
        }

        const updatedPayment = await this.paymentRepo.update(payment, payment.version);

        const transaction = new Transaction({
          paymentId: updatedPayment.id,
          gateway: updatedPayment.gateway!,
          type: TransactionType.PAYMENT,
          status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
          amount: updatedPayment.amount,
          reference: response.reference,
          gatewayTransactionId: response.gatewayTransactionId,
          metadata: response.metadata,
        });

        await this.transactionRepo.create(transaction);

        this.logger.info?.('Payment created successfully', {
          paymentId: updatedPayment.id,
          status: updatedPayment.status,
          gatewayTransactionId: response.gatewayTransactionId,
        });

        return {
          payment: updatedPayment,
          transaction,
          status: updatedPayment.status,
          redirectUrl: response.redirectUrl,
          actionUrl: response.actionUrl,
          action: response.action,
          reference: response.reference,
          gatewayTransactionId: response.gatewayTransactionId,
          rawResponse: response.rawResponse,
        };
      },
    );
  }

  public async getPayment(paymentId: string): Promise<Payment> {
    this.logger.debug?.('Retrieving payment by ID', { paymentId });
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new RepositoryNotFoundError('Payment', paymentId);
    }
    return payment;
  }

  public async inquirePayment(
    paymentId: string,
    options?: Record<string, unknown>,
  ): Promise<InquirePaymentOutput> {
    this.logger.info?.('Inquiring remote payment state', { paymentId });
    const payment = await this.getPayment(paymentId);

    if (!payment.gateway) {
      throw new ValidationError('Gateway is not associated with payment');
    }

    const gateway = this.registry.getActiveGateway(payment.gateway, GatewayCapability.INQUIRY);

    const inquiryCapableGateway = gateway as unknown as CanInquire;
    if (typeof inquiryCapableGateway.inquiry !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.INQUIRY);
    }

    const response: InquiryPaymentResponse = await this.retryPolicy.execute(() =>
      TimeoutPolicy.withTimeout(
        inquiryCapableGateway.inquiry({
          paymentId: payment.id,
          gatewayTransactionId: (payment.metadata?.['gatewayTransactionId'] as string) || undefined,
          reference: (payment.metadata?.['reference'] as string) || undefined,
          options,
        }),
        this.config.defaultTimeoutMs ?? 0,
        `InquirePayment (${payment.gateway})`,
      ),
    );

    let updatedPayment = payment;
    if (response.success && response.status && response.status !== payment.status) {
      payment.transitionTo(response.status);
      updatedPayment = await this.paymentRepo.update(payment, payment.version);
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

    await this.transactionRepo.create(transaction);

    return {
      payment: updatedPayment,
      transaction,
      status: updatedPayment.status,
      reference: response.reference,
      gatewayTransactionId: response.gatewayTransactionId,
      amount: response.amount,
      rawResponse: response.rawResponse,
    };
  }

  public async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentOutput> {
    this.logger.info?.('Verifying payment', {
      paymentId: input.paymentId,
      reference: input.reference,
    });

    let payment: Payment | null = null;
    if (input.paymentId) {
      payment = await this.paymentRepo.findById(input.paymentId);
    } else if (input.gatewayTransactionId) {
      payment = await this.paymentRepo.findByExternalId(input.gatewayTransactionId);
    }

    if (!payment) {
      throw new ValidationError('Payment not found for verification input');
    }

    // Short-circuit if already verified / SUCCESS
    if (payment.status === PaymentStatus.SUCCESS) {
      this.logger.info?.('Payment is already in SUCCESS state, short-circuiting verification', {
        paymentId: payment.id,
      });
      const existingTx = (
        await this.transactionRepo.findByType(payment.id, TransactionType.VERIFY)
      )[0];

      const tx =
        existingTx ||
        new Transaction({
          paymentId: payment.id,
          gateway: payment.gateway || 'unknown',
          type: TransactionType.VERIFY,
          status: TransactionStatus.SUCCESS,
          amount: payment.amount,
        });

      return {
        payment,
        transaction: tx,
        status: payment.status,
        reference: tx.reference,
        gatewayTransactionId: tx.gatewayTransactionId,
      };
    }

    const scope = `verify_payment:${payment.id}`;
    const key = input.idempotencyKey || `verify_${payment.id}`;

    return this.idempotencyOrchestrator.executeIdempotent<VerifyPaymentOutput>(
      scope,
      key,
      input,
      async () => {
        if (!payment.gateway) {
          throw new ValidationError('Gateway is not associated with payment');
        }

        const gateway = this.registry.getActiveGateway(payment.gateway, GatewayCapability.VERIFY);

        const verifyCapableGateway = gateway as unknown as CanVerify;
        if (typeof verifyCapableGateway.verify !== 'function') {
          throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.VERIFY);
        }

        const response: VerifyPaymentResponse = await this.retryPolicy.execute(() =>
          TimeoutPolicy.withTimeout(
            verifyCapableGateway.verify({
              paymentId: payment.id,
              amount: payment.amount,
              currency: payment.currency,
              gatewayTransactionId: input.gatewayTransactionId,
              reference: input.reference,
              callbackData: input.callbackData,
              options: input.options,
            }),
            this.config.defaultTimeoutMs ?? 0,
            `VerifyPayment (${payment.gateway})`,
          ),
        );

        if (response.success) {
          payment.transitionTo(PaymentStatus.SUCCESS);
        } else {
          payment.transitionTo(PaymentStatus.FAILED);
        }

        const updatedPayment = await this.paymentRepo.update(payment, payment.version);

        const transaction = new Transaction({
          paymentId: updatedPayment.id,
          gateway: updatedPayment.gateway!,
          type: TransactionType.VERIFY,
          status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
          amount: updatedPayment.amount,
          reference: response.reference,
          gatewayTransactionId: response.gatewayTransactionId,
          metadata: response.metadata,
        });

        await this.transactionRepo.create(transaction);

        return {
          payment: updatedPayment,
          transaction,
          status: updatedPayment.status,
          reference: response.reference,
          gatewayTransactionId: response.gatewayTransactionId,
          cardMask: response.cardMask,
          rawResponse: response.rawResponse,
        };
      },
    );
  }

  public async handleCallback(
    gatewayId: string,
    request: CallbackRequest,
  ): Promise<CallbackProcessingOutput> {
    this.logger.info?.('Handling browser callback', { gatewayId });

    const gateway = this.registry.getActiveGateway(gatewayId, GatewayCapability.CALLBACK);

    const callbackCapableGateway = gateway as unknown as CanHandleCallback;
    if (typeof callbackCapableGateway.parseCallback !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.CALLBACK);
    }

    const parsed = await callbackCapableGateway.parseCallback(request);

    let payment: Payment | null = null;
    if (parsed.paymentId) {
      payment = await this.paymentRepo.findById(parsed.paymentId);
    } else if (parsed.gatewayTransactionId) {
      payment = await this.paymentRepo.findByExternalId(parsed.gatewayTransactionId);
    }

    if (payment) {
      try {
        payment.transitionTo(PaymentStatus.CALLBACK_RECEIVED);
        payment = await this.paymentRepo.update(payment, payment.version);
      } catch {
        // If transition to CALLBACK_RECEIVED is not allowed (e.g. already SUCCESS/FAILED), keep current payment state
      }
    }

    return {
      payment: payment || undefined,
      isSuccess: parsed.isSuccess,
      paymentId: parsed.paymentId,
      gatewayTransactionId: parsed.gatewayTransactionId,
      reference: parsed.reference,
      rawData: parsed.rawData,
    };
  }

  public async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    this.logger.info?.('Authorizing payment', { gateway: input.gateway, amount: input.amount });

    if (!input.gateway) {
      throw new ValidationError('Gateway identifier is required');
    }
    if (!input.amount || input.amount <= 0) {
      throw new ValidationError('Payment amount must be greater than 0');
    }

    const gateway = this.registry.getActiveGateway(input.gateway, GatewayCapability.AUTHORIZE);

    const authorizeCapableGateway = gateway as unknown as CanAuthorize;
    if (typeof authorizeCapableGateway.authorize !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.AUTHORIZE);
    }

    const scope = `authorize_payment:${input.gateway}`;
    const key = input.idempotencyKey;

    return this.idempotencyOrchestrator.executeIdempotent<AuthorizePaymentOutput>(
      scope,
      key,
      input,
      async () => {
        const payment = new Payment({
          amount: input.amount,
          currency: input.currency,
          gateway: input.gateway,
          callbackUrl: input.callbackUrl,
          description: input.description,
          projectId: input.projectId,
          metadata: input.metadata,
          idempotencyKey: input.idempotencyKey,
          status: PaymentStatus.CREATED,
        });

        await this.paymentRepo.create(payment);

        const response: AuthorizePaymentResponse = await this.retryPolicy.execute(() =>
          TimeoutPolicy.withTimeout(
            authorizeCapableGateway.authorize({
              payment,
              options: input.options,
            }),
            this.config.defaultTimeoutMs ?? 0,
            `AuthorizePayment (${input.gateway})`,
          ),
        );

        if (response.success) {
          payment.transitionTo(response.status || PaymentStatus.AUTHORIZED);
        } else {
          payment.transitionTo(PaymentStatus.FAILED);
        }

        const updatedPayment = await this.paymentRepo.update(payment, payment.version);

        const transaction = new Transaction({
          paymentId: updatedPayment.id,
          gateway: updatedPayment.gateway!,
          type: TransactionType.AUTHORIZATION,
          status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
          amount: updatedPayment.amount,
          reference: response.reference,
          gatewayTransactionId: response.gatewayTransactionId,
          metadata: response.metadata,
        });

        await this.transactionRepo.create(transaction);

        return {
          payment: updatedPayment,
          transaction,
          status: updatedPayment.status,
          redirectUrl: response.redirectUrl,
          actionUrl: response.actionUrl,
          reference: response.reference,
          gatewayTransactionId: response.gatewayTransactionId,
          rawResponse: response.rawResponse,
        };
      },
    );
  }

  public async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    this.logger.info?.('Capturing payment', { paymentId: input.paymentId, amount: input.amount });

    const payment = await this.getPayment(input.paymentId);

    if (payment.status !== PaymentStatus.AUTHORIZED) {
      throw new InvalidPaymentStateError(payment.status, PaymentStatus.SUCCESS);
    }

    const captureAmount = input.amount ?? payment.amount;

    const scope = `capture_payment:${payment.id}`;
    const key = input.idempotencyKey || `capture_${payment.id}`;

    return this.idempotencyOrchestrator.executeIdempotent<CapturePaymentOutput>(
      scope,
      key,
      input,
      async () => {
        if (!payment.gateway) {
          throw new ValidationError('Gateway is not associated with payment');
        }

        const gateway = this.registry.getActiveGateway(payment.gateway, GatewayCapability.CAPTURE);

        const captureCapableGateway = gateway as unknown as CanCapture;
        if (typeof captureCapableGateway.capture !== 'function') {
          throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.CAPTURE);
        }

        const response: CapturePaymentResponse = await this.retryPolicy.execute(() =>
          TimeoutPolicy.withTimeout(
            captureCapableGateway.capture({
              paymentId: payment.id,
              amount: captureAmount,
              currency: payment.currency,
              gatewayTransactionId:
                (payment.metadata?.['gatewayTransactionId'] as string) || undefined,
              options: input.options,
            }),
            this.config.defaultTimeoutMs ?? 0,
            `CapturePayment (${payment.gateway})`,
          ),
        );

        if (response.success) {
          payment.transitionTo(response.status || PaymentStatus.SUCCESS);
        } else {
          payment.transitionTo(PaymentStatus.FAILED);
        }

        const updatedPayment = await this.paymentRepo.update(payment, payment.version);

        const transaction = new Transaction({
          paymentId: updatedPayment.id,
          gateway: updatedPayment.gateway!,
          type: TransactionType.CAPTURE,
          status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
          amount: response.amountCaptured || captureAmount,
          gatewayTransactionId: response.captureTransactionId,
          metadata: response.metadata,
        });

        await this.transactionRepo.create(transaction);

        return {
          payment: updatedPayment,
          transaction,
          status: updatedPayment.status,
          amountCaptured: response.amountCaptured || captureAmount,
          captureTransactionId: response.captureTransactionId,
          rawResponse: response.rawResponse,
        };
      },
    );
  }

  public async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    this.logger.info?.('Refunding payment', { paymentId: input.paymentId, amount: input.amount });

    const payment = await this.getPayment(input.paymentId);

    if (
      payment.status !== PaymentStatus.SUCCESS &&
      payment.status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new InvalidPaymentStateError(payment.status, PaymentStatus.REFUNDED);
    }

    const existingRefundTxs = await this.transactionRepo.findByType(
      payment.id,
      TransactionType.REFUND,
    );
    const totalRefunded = existingRefundTxs
      .filter((tx: Transaction) => tx.status === TransactionStatus.SUCCESS)
      .reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);

    const remainingRefundable = payment.amount - totalRefunded;
    const requestedRefundAmount = input.amount ?? remainingRefundable;

    if (requestedRefundAmount <= 0) {
      throw new ValidationError('Refund amount must be greater than 0');
    }

    if (requestedRefundAmount > remainingRefundable) {
      throw new ValidationError(
        `Refund amount ${requestedRefundAmount} exceeds remaining refundable amount ${remainingRefundable}`,
      );
    }

    const scope = `refund_payment:${payment.id}`;
    const key = input.idempotencyKey || `refund_${payment.id}_${randomUUID()}`;

    return this.idempotencyOrchestrator.executeIdempotent<RefundPaymentOutput>(
      scope,
      key,
      input,
      async () => {
        if (!payment.gateway) {
          throw new ValidationError('Gateway is not associated with payment');
        }

        const gateway = this.registry.getActiveGateway(payment.gateway, GatewayCapability.REFUND);

        const refundCapableGateway = gateway as unknown as CanRefund;
        if (typeof refundCapableGateway.refund !== 'function') {
          throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.REFUND);
        }

        const response: RefundPaymentResponse = await this.retryPolicy.execute(() =>
          TimeoutPolicy.withTimeout(
            refundCapableGateway.refund({
              paymentId: payment.id,
              amount: requestedRefundAmount,
              currency: payment.currency,
              reason: input.reason,
              options: input.options,
            }),
            this.config.defaultTimeoutMs ?? 0,
            `RefundPayment (${payment.gateway})`,
          ),
        );

        if (response.success) {
          const actualRefunded = response.amountRefunded || requestedRefundAmount;
          const newTotalRefunded = totalRefunded + actualRefunded;
          const isPartial = newTotalRefunded < payment.amount;

          payment.transitionTo(
            isPartial ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED,
          );
        }

        const updatedPayment = await this.paymentRepo.update(payment, payment.version);

        const transaction = new Transaction({
          paymentId: updatedPayment.id,
          gateway: updatedPayment.gateway!,
          type: TransactionType.REFUND,
          status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
          amount: response.amountRefunded || requestedRefundAmount,
          gatewayTransactionId: response.refundTransactionId,
          metadata: response.metadata,
        });

        await this.transactionRepo.create(transaction);

        return {
          payment: updatedPayment,
          transaction,
          status: updatedPayment.status,
          amountRefunded: response.amountRefunded || requestedRefundAmount,
          refundTransactionId: response.refundTransactionId,
          rawResponse: response.rawResponse,
        };
      },
    );
  }

  public async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    this.logger.info?.('Cancelling payment', { paymentId: input.paymentId });

    const payment = await this.getPayment(input.paymentId);

    const scope = `cancel_payment:${payment.id}`;
    const key = input.idempotencyKey || `cancel_${payment.id}`;

    return this.idempotencyOrchestrator.executeIdempotent<CancelPaymentOutput>(
      scope,
      key,
      input,
      async () => {
        if (!payment.gateway) {
          throw new ValidationError('Gateway is not associated with payment');
        }

        const gateway = this.registry.getActiveGateway(payment.gateway, GatewayCapability.CANCEL);

        const cancelCapableGateway = gateway as unknown as CanCancel;
        if (typeof cancelCapableGateway.cancel !== 'function') {
          throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.CANCEL);
        }

        const response: CancelPaymentResponse = await this.retryPolicy.execute(() =>
          TimeoutPolicy.withTimeout(
            cancelCapableGateway.cancel({
              paymentId: payment.id,
              reason: input.reason,
              options: input.options,
            }),
            this.config.defaultTimeoutMs ?? 0,
            `CancelPayment (${payment.gateway})`,
          ),
        );

        if (response.success) {
          payment.transitionTo(PaymentStatus.CANCELLED);
        }

        const updatedPayment = await this.paymentRepo.update(payment, payment.version);

        const transaction = new Transaction({
          paymentId: updatedPayment.id,
          gateway: updatedPayment.gateway!,
          type: TransactionType.CANCEL,
          status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
          amount: updatedPayment.amount,
          gatewayTransactionId: response.cancelTransactionId,
          metadata: response.metadata,
        });

        await this.transactionRepo.create(transaction);

        return {
          payment: updatedPayment,
          transaction,
          status: updatedPayment.status,
          cancelTransactionId: response.cancelTransactionId,
          rawResponse: response.rawResponse,
        };
      },
    );
  }

  public async reversePayment(input: ReversePaymentInput): Promise<ReversePaymentOutput> {
    this.logger.info?.('Reversing payment', { paymentId: input.paymentId });

    const payment = await this.getPayment(input.paymentId);

    const scope = `reverse_payment:${payment.id}`;
    const key = input.idempotencyKey || `reverse_${payment.id}`;

    return this.idempotencyOrchestrator.executeIdempotent<ReversePaymentOutput>(
      scope,
      key,
      input,
      async () => {
        if (!payment.gateway) {
          throw new ValidationError('Gateway is not associated with payment');
        }

        const gateway = this.registry.getActiveGateway(payment.gateway, GatewayCapability.REVERSE);

        const reverseCapableGateway = gateway as unknown as CanReverse;
        if (typeof reverseCapableGateway.reverse !== 'function') {
          throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.REVERSE);
        }

        const response: ReversePaymentResponse = await this.retryPolicy.execute(() =>
          TimeoutPolicy.withTimeout(
            reverseCapableGateway.reverse({
              paymentId: payment.id,
              reason: input.reason,
              options: input.options,
            }),
            this.config.defaultTimeoutMs ?? 0,
            `ReversePayment (${payment.gateway})`,
          ),
        );

        if (response.success) {
          payment.transitionTo(PaymentStatus.REVERSED);
        }

        const updatedPayment = await this.paymentRepo.update(payment, payment.version);

        const transaction = new Transaction({
          paymentId: updatedPayment.id,
          gateway: updatedPayment.gateway!,
          type: TransactionType.REVERSE,
          status: response.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
          amount: updatedPayment.amount,
          gatewayTransactionId: response.reverseTransactionId,
          metadata: response.metadata,
        });

        await this.transactionRepo.create(transaction);

        return {
          payment: updatedPayment,
          transaction,
          status: updatedPayment.status,
          reverseTransactionId: response.reverseTransactionId,
          rawResponse: response.rawResponse,
        };
      },
    );
  }

  public async handleWebhook(
    gatewayId: string,
    request: WebhookRequest,
  ): Promise<WebhookProcessingOutput> {
    this.logger.info?.('Handling webhook event', { gatewayId });

    const gateway = this.registry.getActiveGateway(gatewayId, GatewayCapability.WEBHOOK);

    const webhookCapableGateway = gateway as unknown as CanHandleWebhook;
    if (typeof webhookCapableGateway.parseWebhook !== 'function') {
      throw new UnsupportedCapabilityError(gateway.id, GatewayCapability.WEBHOOK);
    }

    const parsed = await webhookCapableGateway.parseWebhook(request);

    const headerEventId = (request.headers['x-event-id'] || request.headers['X-Event-ID']) as
      string | undefined;
    const bodyEventId = (request.body?.['id'] || request.body?.['eventId']) as string | undefined;
    const eventId =
      headerEventId ||
      bodyEventId ||
      createHash('sha256')
        .update(
          `${gatewayId}:${parsed.eventType}:${parsed.paymentId || ''}:${parsed.gatewayTransactionId || ''}:${JSON.stringify(request.body || {})}`,
        )
        .digest('hex');

    if (this.webhookRepo) {
      const existing = await this.webhookRepo.findByProviderAndEventId(gatewayId, eventId);
      if (existing && existing.status === WebhookEventStatus.PROCESSED) {
        this.logger.info?.('Webhook event already processed (deduplicated)', {
          gatewayId,
          eventId,
        });

        let payment: Payment | null = null;
        if (parsed.paymentId) {
          payment = await this.paymentRepo.findById(parsed.paymentId);
        } else if (parsed.gatewayTransactionId) {
          payment = await this.paymentRepo.findByExternalId(parsed.gatewayTransactionId);
        }

        return {
          webhookEvent: existing,
          payment: payment || undefined,
          eventType: parsed.eventType,
          isDuplicate: true,
        };
      }
    }

    let webhookEvent = new WebhookEvent({
      provider: gatewayId,
      eventId,
      eventType: parsed.eventType,
      status: WebhookEventStatus.RECEIVED,
      payload: (request.body as Record<string, unknown>) || {},
    });

    if (this.webhookRepo) {
      webhookEvent = await this.webhookRepo.create(webhookEvent);

      webhookEvent = new WebhookEvent({
        id: webhookEvent.id,
        provider: webhookEvent.provider,
        eventId: webhookEvent.eventId,
        eventType: webhookEvent.eventType,
        status: WebhookEventStatus.PROCESSING,
        payload: webhookEvent.payload,
        attempts: webhookEvent.attempts + 1,
        error: webhookEvent.error,
        receivedAt: webhookEvent.receivedAt,
        processedAt: webhookEvent.processedAt,
        createdAt: webhookEvent.createdAt,
      });
      webhookEvent = await this.webhookRepo.update(webhookEvent);
    }

    let payment: Payment | null = null;
    if (parsed.paymentId) {
      payment = await this.paymentRepo.findById(parsed.paymentId);
    } else if (parsed.gatewayTransactionId) {
      payment = await this.paymentRepo.findByExternalId(parsed.gatewayTransactionId);
    }

    if (payment && parsed.status) {
      // Out-of-order event check: Do not regress terminal status
      const terminalStatuses: readonly PaymentStatus[] = [
        PaymentStatus.SUCCESS,
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
        PaymentStatus.REFUNDED,
        PaymentStatus.REVERSED,
      ];

      if (!terminalStatuses.includes(payment.status)) {
        try {
          payment.transitionTo(parsed.status);
          payment = await this.paymentRepo.update(payment, payment.version);
        } catch {
          this.logger.warn?.('Invalid payment state transition ignored during webhook processing', {
            paymentId: payment.id,
            currentStatus: payment.status,
            requestedStatus: parsed.status,
          });
        }
      }
    }

    if (this.webhookRepo) {
      webhookEvent = new WebhookEvent({
        id: webhookEvent.id,
        provider: webhookEvent.provider,
        eventId: webhookEvent.eventId,
        eventType: webhookEvent.eventType,
        status: WebhookEventStatus.PROCESSED,
        payload: webhookEvent.payload,
        attempts: webhookEvent.attempts,
        error: webhookEvent.error,
        receivedAt: webhookEvent.receivedAt,
        processedAt: this.clock.now(),
        createdAt: webhookEvent.createdAt,
      });
      webhookEvent = await this.webhookRepo.update(webhookEvent);
    }

    return {
      webhookEvent,
      payment: payment || undefined,
      eventType: parsed.eventType,
      isDuplicate: false,
    };
  }
}

export const PaymentService = PaymentApplicationService;
export type PaymentService = PaymentApplicationService;
