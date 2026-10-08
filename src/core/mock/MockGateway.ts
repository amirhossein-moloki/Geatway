import { GatewayCapability, PaymentStatus } from '../domain/enums';
import {
  PaymentGateway,
  CanCreatePayment,
  CanVerifyPayment,
  CanInquirePayment,
  CanRefundPayment,
  CanReversePayment,
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
} from '../contracts/PaymentGateway';
import { GatewayError } from '../errors';

export interface MockGatewayOptions {
  readonly id?: string | undefined;
  readonly name?: string | undefined;
  readonly displayName?: string | undefined;
  readonly enabled?: boolean | undefined;
  readonly capabilities?: ReadonlySet<GatewayCapability> | undefined;
  readonly shouldFailCreatePayment?: boolean | undefined;
  readonly shouldFailVerify?: boolean | undefined;
  readonly shouldFailInquiry?: boolean | undefined;
  readonly failureMessage?: string | undefined;
  readonly failureCode?: string | undefined;
}

export class MockGateway
  implements
    PaymentGateway,
    CanCreatePayment,
    CanVerifyPayment,
    CanInquirePayment,
    CanRefundPayment,
    CanReversePayment
{
  public readonly id: string;
  public readonly name: string;
  public readonly displayName: string;
  public readonly enabled: boolean;
  public readonly capabilities: ReadonlySet<GatewayCapability>;

  private shouldFailCreatePayment: boolean;
  private shouldFailVerify: boolean;
  private shouldFailInquiry: boolean;
  private failureMessage: string;
  private failureCode: string;

  private payments = new Map<
    string,
    {
      paymentId: string;
      amount: number;
      currency: string;
      status: PaymentStatus;
      gatewayTransactionId: string;
      reference?: string | undefined;
    }
  >();

  constructor(options?: MockGatewayOptions) {
    this.id = options?.id ?? 'mock-gateway';
    this.name = options?.name ?? 'mock-gateway';
    this.displayName = options?.displayName ?? 'Mock Payment Gateway';
    this.enabled = options?.enabled ?? true;
    this.capabilities =
      options?.capabilities ??
      new Set([
        GatewayCapability.CREATE_PAYMENT,
        GatewayCapability.VERIFY,
        GatewayCapability.INQUIRY,
        GatewayCapability.REFUND,
        GatewayCapability.REVERSE,
      ]);

    this.shouldFailCreatePayment = options?.shouldFailCreatePayment ?? false;
    this.shouldFailVerify = options?.shouldFailVerify ?? false;
    this.shouldFailInquiry = options?.shouldFailInquiry ?? false;
    this.failureMessage = options?.failureMessage ?? 'Mock gateway operation failed intentionally.';
    this.failureCode = options?.failureCode ?? 'MOCK_FAILURE';
  }

  public setFailCreatePayment(fail: boolean): void {
    this.shouldFailCreatePayment = fail;
  }

  public setFailVerify(fail: boolean): void {
    this.shouldFailVerify = fail;
  }

  public setFailInquiry(fail: boolean): void {
    this.shouldFailInquiry = fail;
  }

  public async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    if (this.shouldFailCreatePayment) {
      throw new GatewayError(this.failureMessage, this.failureCode, {
        paymentId: request.paymentId,
      });
    }

    const gatewayTransactionId = `mock_tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const redirectUrl = `https://mock-gateway.local/pay/${gatewayTransactionId}`;

    this.payments.set(request.paymentId, {
      paymentId: request.paymentId,
      amount: request.amount,
      currency: request.currency,
      status: PaymentStatus.PENDING,
      gatewayTransactionId,
    });

    return {
      success: true,
      gatewayTransactionId,
      redirectUrl,
      actionType: 'REDIRECT',
      rawResponse: {
        mockStatus: 'OK',
        gatewayTransactionId,
      },
    };
  }

  public async verify(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    if (this.shouldFailVerify) {
      throw new GatewayError(this.failureMessage, this.failureCode, {
        paymentId: request.paymentId,
      });
    }

    const record = this.payments.get(request.paymentId);
    const reference = `ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (record) {
      record.status = PaymentStatus.SUCCESS;
      record.reference = reference;
    }

    return {
      success: true,
      status: PaymentStatus.SUCCESS,
      reference,
      gatewayTransactionId: record?.gatewayTransactionId ?? request.gatewayTransactionId,
      rawResponse: {
        mockStatus: 'VERIFIED',
        reference,
      },
    };
  }

  public async inquiry(request: InquiryPaymentRequest): Promise<InquiryPaymentResponse> {
    if (this.shouldFailInquiry) {
      throw new GatewayError(this.failureMessage, this.failureCode, {
        paymentId: request.paymentId,
      });
    }

    const record = this.payments.get(request.paymentId);

    return {
      status: record?.status ?? PaymentStatus.PENDING,
      reference: record?.reference,
      amount: record?.amount,
      rawResponse: {
        mockStatus: 'INQUIRED',
        record,
      },
    };
  }

  public async refund(request: RefundPaymentRequest): Promise<RefundPaymentResponse> {
    const record = this.payments.get(request.paymentId);
    if (record) {
      record.status = PaymentStatus.REFUNDED;
    }
    const refundReference = `refund_${Date.now()}`;
    return {
      success: true,
      refundReference,
      rawResponse: { mockStatus: 'REFUNDED', refundReference },
    };
  }

  public async reverse(request: ReversePaymentRequest): Promise<ReversePaymentResponse> {
    const record = this.payments.get(request.paymentId);
    if (record) {
      record.status = PaymentStatus.REVERSED;
    }
    const reversalReference = `rev_${Date.now()}`;
    return {
      success: true,
      reversalReference,
      rawResponse: { mockStatus: 'REVERSED', reversalReference },
    };
  }
}
