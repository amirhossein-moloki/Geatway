import { Payment, PaymentProps } from '../domain/payment/Payment';
import { Transaction } from '../domain/transaction/Transaction';
import { PaymentStatus, TransactionType, GatewayCapability } from '../domain/enums';
import { PaymentStatusMachine } from '../domain/payment/PaymentStatusMachine';
import { GatewayRegistry } from '../registry/GatewayRegistry';
import { ValidationError, PaymentError, ErrorCode, UnsupportedCapabilityError } from '../errors';
import {
  CreatePaymentResponse,
  VerifyPaymentResponse,
  InquiryPaymentResponse,
  RefundPaymentResponse,
  ReversePaymentResponse,
  CanCreatePayment,
  CanVerifyPayment,
  CanInquirePayment,
  CanRefundPayment,
  CanReversePayment,
} from '../contracts/PaymentGateway';

export interface CreatePaymentDTO {
  readonly id: string;
  readonly projectId: string;
  readonly amount: number;
  readonly currency: string;
  readonly callbackUrl: string;
  readonly gateway: string;
  readonly description?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface VerifyPaymentDTO {
  readonly payment: Payment;
  readonly gatewayTransactionId?: string | undefined;
  readonly reference?: string | undefined;
  readonly callbackData?: Readonly<Record<string, unknown>> | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface InquiryPaymentDTO {
  readonly payment: Payment;
  readonly gatewayTransactionId?: string | undefined;
}

export interface RefundPaymentDTO {
  readonly payment: Payment;
  readonly amount: number;
  readonly reason?: string | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface ReversePaymentDTO {
  readonly payment: Payment;
  readonly reason?: string | undefined;
  readonly idempotencyKey?: string | undefined;
}

export class PaymentCoreService {
  constructor(private readonly registry: GatewayRegistry) {}

  public createPaymentEntity(dto: CreatePaymentDTO): Payment {
    this.validateCreatePaymentDTO(dto);

    const now = new Date();
    const props: PaymentProps = {
      id: dto.id,
      projectId: dto.projectId,
      amount: dto.amount,
      currency: dto.currency,
      callbackUrl: dto.callbackUrl,
      gateway: dto.gateway,
      description: dto.description,
      status: PaymentStatus.CREATED,
      metadata: dto.metadata,
      createdAt: now,
      updatedAt: now,
    };

    return new Payment(props);
  }

  public async initiatePayment(
    payment: Payment,
    idempotencyKey?: string,
  ): Promise<{
    payment: Payment;
    transaction: Transaction;
    gatewayResponse: CreatePaymentResponse;
  }> {
    const gatewayInstance = this.registry.resolveGatewayForOperation(
      payment.gateway,
      GatewayCapability.CREATE_PAYMENT,
    );

    const creator = gatewayInstance as unknown as CanCreatePayment;
    if (typeof creator.createPayment !== 'function') {
      throw new UnsupportedCapabilityError(payment.gateway, GatewayCapability.CREATE_PAYMENT);
    }

    const response = await creator.createPayment({
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      callbackUrl: payment.callbackUrl,
      description: payment.description,
      metadata: payment.metadata,
      idempotencyKey,
    });

    const targetStatus = response.success ? PaymentStatus.PENDING : PaymentStatus.FAILED;
    const updatedPayment = this.transitionStatus(payment, targetStatus);

    const transaction = new Transaction({
      id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      paymentId: payment.id,
      gateway: payment.gateway,
      type: TransactionType.PAYMENT,
      status: targetStatus,
      amount: payment.amount,
      gatewayTransactionId: response.gatewayTransactionId,
      metadata: response.rawResponse,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      payment: updatedPayment,
      transaction,
      gatewayResponse: response,
    };
  }

  public async verifyPayment(dto: VerifyPaymentDTO): Promise<{
    payment: Payment;
    transaction: Transaction;
    gatewayResponse: VerifyPaymentResponse;
  }> {
    const gatewayInstance = this.registry.resolveGatewayForOperation(
      dto.payment.gateway,
      GatewayCapability.VERIFY,
    );

    const verifier = gatewayInstance as unknown as CanVerifyPayment;
    if (typeof verifier.verify !== 'function') {
      throw new UnsupportedCapabilityError(dto.payment.gateway, GatewayCapability.VERIFY);
    }

    const response = await verifier.verify({
      paymentId: dto.payment.id,
      amount: dto.payment.amount,
      gatewayTransactionId: dto.gatewayTransactionId,
      reference: dto.reference,
      callbackData: dto.callbackData,
      idempotencyKey: dto.idempotencyKey,
    });

    const targetStatus = response.success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
    const updatedPayment = this.transitionStatus(dto.payment, targetStatus);

    const transaction = new Transaction({
      id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      paymentId: dto.payment.id,
      gateway: dto.payment.gateway,
      type: TransactionType.VERIFY,
      status: targetStatus,
      amount: dto.payment.amount,
      reference: response.reference,
      gatewayTransactionId: response.gatewayTransactionId ?? dto.gatewayTransactionId,
      metadata: response.rawResponse,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      payment: updatedPayment,
      transaction,
      gatewayResponse: response,
    };
  }

  public async inquirePayment(dto: InquiryPaymentDTO): Promise<{
    gatewayResponse: InquiryPaymentResponse;
  }> {
    const gatewayInstance = this.registry.resolveGatewayForOperation(
      dto.payment.gateway,
      GatewayCapability.INQUIRY,
    );

    const inquirer = gatewayInstance as unknown as CanInquirePayment;
    if (typeof inquirer.inquiry !== 'function') {
      throw new UnsupportedCapabilityError(dto.payment.gateway, GatewayCapability.INQUIRY);
    }

    const response = await inquirer.inquiry({
      paymentId: dto.payment.id,
      gatewayTransactionId: dto.gatewayTransactionId,
    });

    return { gatewayResponse: response };
  }

  public async refundPayment(dto: RefundPaymentDTO): Promise<{
    payment: Payment;
    transaction: Transaction;
    gatewayResponse: RefundPaymentResponse;
  }> {
    const gatewayInstance = this.registry.resolveGatewayForOperation(
      dto.payment.gateway,
      GatewayCapability.REFUND,
    );

    const refunder = gatewayInstance as unknown as CanRefundPayment;
    if (typeof refunder.refund !== 'function') {
      throw new UnsupportedCapabilityError(dto.payment.gateway, GatewayCapability.REFUND);
    }

    const response = await refunder.refund({
      paymentId: dto.payment.id,
      amount: dto.amount,
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey,
    });

    const targetStatus = response.success ? PaymentStatus.REFUNDED : dto.payment.status;
    const updatedPayment = response.success
      ? this.transitionStatus(dto.payment, targetStatus)
      : dto.payment;

    const transaction = new Transaction({
      id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      paymentId: dto.payment.id,
      gateway: dto.payment.gateway,
      type: TransactionType.REFUND,
      status: targetStatus,
      amount: dto.amount,
      reference: response.refundReference,
      metadata: response.rawResponse,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      payment: updatedPayment,
      transaction,
      gatewayResponse: response,
    };
  }

  public async reversePayment(dto: ReversePaymentDTO): Promise<{
    payment: Payment;
    transaction: Transaction;
    gatewayResponse: ReversePaymentResponse;
  }> {
    const gatewayInstance = this.registry.resolveGatewayForOperation(
      dto.payment.gateway,
      GatewayCapability.REVERSE,
    );

    const reverser = gatewayInstance as unknown as CanReversePayment;
    if (typeof reverser.reverse !== 'function') {
      throw new UnsupportedCapabilityError(dto.payment.gateway, GatewayCapability.REVERSE);
    }

    const response = await reverser.reverse({
      paymentId: dto.payment.id,
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey,
    });

    const targetStatus = response.success ? PaymentStatus.REVERSED : dto.payment.status;
    const updatedPayment = response.success
      ? this.transitionStatus(dto.payment, targetStatus)
      : dto.payment;

    const transaction = new Transaction({
      id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      paymentId: dto.payment.id,
      gateway: dto.payment.gateway,
      type: TransactionType.REVERSE,
      status: targetStatus,
      amount: dto.payment.amount,
      reference: response.reversalReference,
      metadata: response.rawResponse,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      payment: updatedPayment,
      transaction,
      gatewayResponse: response,
    };
  }

  public transitionStatus(payment: Payment, targetStatus: PaymentStatus): Payment {
    if (!PaymentStatusMachine.canTransition(payment.status, targetStatus)) {
      throw new PaymentError(
        `Cannot transition payment '${payment.id}' from status '${payment.status}' to '${targetStatus}'.`,
        ErrorCode.INVALID_STATUS_TRANSITION,
        {
          paymentId: payment.id,
          currentStatus: payment.status,
          targetStatus,
        },
      );
    }
    return payment.withStatus(targetStatus);
  }

  private validateCreatePaymentDTO(dto: CreatePaymentDTO): void {
    if (!dto.id || dto.id.trim() === '') {
      throw new ValidationError('Payment ID is required.');
    }
    if (!dto.projectId || dto.projectId.trim() === '') {
      throw new ValidationError('Project ID is required.');
    }
    if (typeof dto.amount !== 'number' || dto.amount <= 0) {
      throw new ValidationError('Amount must be a positive number.');
    }
    if (!dto.currency || dto.currency.trim() === '') {
      throw new ValidationError('Currency is required.');
    }
    if (!dto.callbackUrl || dto.callbackUrl.trim() === '') {
      throw new ValidationError('Callback URL is required.');
    }
    if (!dto.gateway || dto.gateway.trim() === '') {
      throw new ValidationError('Gateway identifier is required.');
    }
  }
}
