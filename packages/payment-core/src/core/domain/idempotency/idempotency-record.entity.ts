import { ValidationError } from '../../errors/index.js';

export enum IdempotencyStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface CreateIdempotencyRecordProps {
  id?: string;
  scope: string;
  key: string;
  requestHash: string;
  status?: IdempotencyStatus;
  result?: Record<string, unknown> | unknown;
  createdAt?: Date;
  updatedAt?: Date;
  expiresAt?: Date | null;
}

export class IdempotencyRecord {
  public readonly id: string;
  public readonly scope: string;
  public readonly key: string;
  public readonly requestHash: string;
  public readonly status: IdempotencyStatus;
  public readonly result?: Record<string, unknown> | unknown;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly expiresAt?: Date | null;

  constructor(props: CreateIdempotencyRecordProps) {
    if (!props.scope) {
      throw new ValidationError('Idempotency record scope is required');
    }
    if (!props.key) {
      throw new ValidationError('Idempotency record key is required');
    }
    if (!props.requestHash) {
      throw new ValidationError('Idempotency record requestHash is required');
    }

    this.id = props.id || IdempotencyRecord.generateId();
    this.scope = props.scope;
    this.key = props.key;
    this.requestHash = props.requestHash;
    this.status = props.status || IdempotencyStatus.PENDING;
    this.result = props.result;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
    this.expiresAt = props.expiresAt ?? null;
  }

  public isExpired(now: Date = new Date()): boolean {
    return this.expiresAt !== null && this.expiresAt !== undefined && this.expiresAt < now;
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      scope: this.scope,
      key: this.key,
      requestHash: this.requestHash,
      status: this.status,
      result: this.result,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      expiresAt: this.expiresAt ? this.expiresAt.toISOString() : null,
    };
  }

  private static generateId(): string {
    return `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
