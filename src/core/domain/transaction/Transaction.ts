import { TransactionType, PaymentStatus } from '../enums';

export interface TransactionProps {
  readonly id: string;
  readonly paymentId: string;
  readonly gateway: string;
  readonly type: TransactionType;
  readonly status: PaymentStatus;
  readonly amount: number;
  readonly reference?: string | undefined;
  readonly gatewayTransactionId?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Transaction {
  public readonly id: string;
  public readonly paymentId: string;
  public readonly gateway: string;
  public readonly type: TransactionType;
  public readonly status: PaymentStatus;
  public readonly amount: number;
  public readonly reference?: string | undefined;
  public readonly gatewayTransactionId?: string | undefined;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: TransactionProps) {
    this.id = props.id;
    this.paymentId = props.paymentId;
    this.gateway = props.gateway;
    this.type = props.type;
    this.status = props.status;
    this.amount = props.amount;
    this.reference = props.reference;
    this.gatewayTransactionId = props.gatewayTransactionId;
    this.metadata = Object.freeze(props.metadata ? { ...props.metadata } : {});
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    Object.freeze(this);
  }
}
