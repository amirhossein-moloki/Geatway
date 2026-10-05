export enum TransactionType {
  PAYMENT = 'PAYMENT',
  VERIFY = 'VERIFY',
  REFUND = 'REFUND',
  REVERSE = 'REVERSE',
  INQUIRY = 'INQUIRY',
}

export enum TransactionStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
}

export interface CreateTransactionProps {
  id?: string;
  paymentId: string;
  gateway: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  reference?: string;
  gatewayTransactionId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Transaction {
  public readonly id: string;
  public readonly paymentId: string;
  public readonly gateway: string;
  public readonly type: TransactionType;
  public readonly status: TransactionStatus;
  public readonly amount: number;
  public readonly reference?: string;
  public readonly gatewayTransactionId?: string;
  public readonly metadata: Record<string, unknown>;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: CreateTransactionProps) {
    this.id = props.id || Transaction.generateId();
    this.paymentId = props.paymentId;
    this.gateway = props.gateway;
    this.type = props.type;
    this.status = props.status;
    this.amount = props.amount;
    this.reference = props.reference;
    this.gatewayTransactionId = props.gatewayTransactionId;
    this.metadata = props.metadata || {};
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      paymentId: this.paymentId,
      gateway: this.gateway,
      type: this.type,
      status: this.status,
      amount: this.amount,
      reference: this.reference,
      gatewayTransactionId: this.gatewayTransactionId,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  private static generateId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
