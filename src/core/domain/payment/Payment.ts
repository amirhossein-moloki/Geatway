import { PaymentStatus } from '../enums';

export interface PaymentProps {
  readonly id: string;
  readonly projectId: string;
  readonly amount: number;
  readonly currency: string;
  readonly description?: string | undefined;
  readonly callbackUrl: string;
  readonly gateway: string;
  readonly status: PaymentStatus;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Payment {
  public readonly id: string;
  public readonly projectId: string;
  public readonly amount: number;
  public readonly currency: string;
  public readonly description?: string | undefined;
  public readonly callbackUrl: string;
  public readonly gateway: string;
  public readonly status: PaymentStatus;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: PaymentProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.amount = props.amount;
    this.currency = props.currency;
    this.description = props.description;
    this.callbackUrl = props.callbackUrl;
    this.gateway = props.gateway;
    this.status = props.status;
    this.metadata = Object.freeze(props.metadata ? { ...props.metadata } : {});
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    Object.freeze(this);
  }

  public withStatus(newStatus: PaymentStatus): Payment {
    return new Payment({
      ...this,
      status: newStatus,
      updatedAt: new Date(),
    });
  }

  public withMetadata(additionalMetadata: Record<string, unknown>): Payment {
    return new Payment({
      ...this,
      metadata: { ...this.metadata, ...additionalMetadata },
      updatedAt: new Date(),
    });
  }
}
