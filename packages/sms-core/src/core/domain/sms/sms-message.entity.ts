import { SmsStatus } from './sms-status.enum.js';
import { SmsType } from './sms-type.enum.js';
import { InvalidSmsStateError, SmsValidationError } from '../../errors/index.js';

export class SmsStateMachine {
  private static readonly allowedTransitions: Record<SmsStatus, ReadonlySet<SmsStatus>> = {
    [SmsStatus.PENDING]: new Set([
      SmsStatus.SENT,
      SmsStatus.DELIVERED,
      SmsStatus.FAILED,
      SmsStatus.REJECTED,
      SmsStatus.CANCELLED,
    ]),
    [SmsStatus.SENT]: new Set([
      SmsStatus.DELIVERED,
      SmsStatus.FAILED,
      SmsStatus.REJECTED,
      SmsStatus.CANCELLED,
    ]),
    [SmsStatus.DELIVERED]: new Set([]),
    [SmsStatus.FAILED]: new Set([SmsStatus.SENT, SmsStatus.DELIVERED]),
    [SmsStatus.REJECTED]: new Set([]),
    [SmsStatus.CANCELLED]: new Set([]),
  };

  public static canTransition(currentStatus: SmsStatus, newStatus: SmsStatus): boolean {
    if (currentStatus === newStatus) {
      return true;
    }
    const allowed = this.allowedTransitions[currentStatus];
    return allowed ? allowed.has(newStatus) : false;
  }
}

export interface PatternParameter {
  readonly name: string;
  readonly value: string;
}

export interface CreateSmsMessageProps {
  id?: string;
  provider?: string;
  type?: SmsType;
  line?: string;
  recipients: string[];
  messageTexts?: string[];
  patternId?: number | string;
  patternParameters?: PatternParameter[];
  sendDateTime?: Date | number | null;
  status?: SmsStatus;
  metadata?: Record<string, unknown>;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SmsMessage {
  public readonly id: string;
  public readonly provider?: string;
  public readonly type: SmsType;
  public readonly line?: string;
  public readonly recipients: string[];
  public readonly messageTexts: string[];
  public readonly patternId?: number | string;
  public readonly patternParameters?: PatternParameter[];
  public readonly sendDateTime?: Date | number | null;
  private _status: SmsStatus;
  public readonly metadata: Record<string, unknown>;
  public sentAt?: Date | null;
  public deliveredAt?: Date | null;
  public readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CreateSmsMessageProps) {
    if (!props.recipients || props.recipients.length === 0) {
      throw new SmsValidationError('At least one recipient mobile number is required');
    }

    this.id = props.id || SmsMessage.generateId();
    this.provider = props.provider;
    this.type = props.type || SmsType.SINGLE;
    this.line = props.line;
    this.recipients = props.recipients;
    this.messageTexts = props.messageTexts || [];
    this.patternId = props.patternId;
    this.patternParameters = props.patternParameters;
    this.sendDateTime = props.sendDateTime ?? null;
    this._status = props.status || SmsStatus.PENDING;
    this.metadata = props.metadata || {};
    this.sentAt = props.sentAt ?? null;
    this.deliveredAt = props.deliveredAt ?? null;
    this.createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public get status(): SmsStatus {
    return this._status;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public transitionTo(newStatus: SmsStatus): void {
    if (!SmsStateMachine.canTransition(this._status, newStatus)) {
      throw new InvalidSmsStateError(this._status, newStatus);
    }
    this._status = newStatus;
    this._updatedAt = new Date();

    if (newStatus === SmsStatus.SENT && !this.sentAt) {
      this.sentAt = new Date();
    } else if (newStatus === SmsStatus.DELIVERED && !this.deliveredAt) {
      this.deliveredAt = new Date();
      if (!this.sentAt) {
        this.sentAt = this.deliveredAt;
      }
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      provider: this.provider,
      type: this.type,
      line: this.line,
      recipients: this.recipients,
      messageTexts: this.messageTexts,
      patternId: this.patternId,
      patternParameters: this.patternParameters,
      sendDateTime: this.sendDateTime,
      status: this.status,
      metadata: this.metadata,
      sentAt: this.sentAt ? this.sentAt.toISOString() : null,
      deliveredAt: this.deliveredAt ? this.deliveredAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  private static generateId(): string {
    return `sms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
