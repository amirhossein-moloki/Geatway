import { PaymentStatus, PaymentStateMachine } from './payment-status.enum.js';
import { InvalidStateTransitionError, ValidationError } from '../../errors/index.js';

export interface CreatePaymentProps {
  id?: string;
  projectId: string;
  amount: number;
  currency: string;
  description?: string;
  callbackUrl?: string;
  gateway: string;
  status?: PaymentStatus;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Payment {
  public readonly id: string;
  public readonly projectId: string;
  public readonly amount: number;
  public readonly currency: string;
  public readonly description?: string;
  public readonly callbackUrl?: string;
  public readonly gateway: string;
  private _status: PaymentStatus;
  public readonly metadata: Record<string, unknown>;
  public readonly idempotencyKey?: string;
  public readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CreatePaymentProps) {
    if (!props.projectId) {
      throw new ValidationError('Payment projectId is required');
    }
    if (props.amount <= 0) {
      throw new ValidationError('Payment amount must be greater than 0');
    }
    if (!props.currency) {
      throw new ValidationError('Payment currency is required');
    }
    if (!props.gateway) {
      throw new ValidationError('Payment gateway is required');
    }

    this.id = props.id || Payment.generateId();
    this.projectId = props.projectId;
    this.amount = props.amount;
    this.currency = props.currency.toUpperCase();
    this.description = props.description;
    this.callbackUrl = props.callbackUrl;
    this.gateway = props.gateway;
    this._status = props.status || PaymentStatus.CREATED;
    this.metadata = props.metadata || {};
    this.idempotencyKey = props.idempotencyKey;
    this.createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public get status(): PaymentStatus {
    return this._status;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public transitionTo(newStatus: PaymentStatus): void {
    if (!PaymentStateMachine.canTransition(this._status, newStatus)) {
      throw new InvalidStateTransitionError(this._status, newStatus);
    }
    this._status = newStatus;
    this._updatedAt = new Date();
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      projectId: this.projectId,
      amount: this.amount,
      currency: this.currency,
      description: this.description,
      callbackUrl: this.callbackUrl,
      gateway: this.gateway,
      status: this.status,
      metadata: this.metadata,
      idempotencyKey: this.idempotencyKey,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  private static generateId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
