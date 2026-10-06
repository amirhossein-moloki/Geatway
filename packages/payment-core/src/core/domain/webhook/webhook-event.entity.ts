import { ValidationError } from '../../errors/index.js';

export enum WebhookEventStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

export interface CreateWebhookEventProps {
  id?: string;
  provider: string;
  eventId: string;
  eventType: string;
  status?: WebhookEventStatus;
  payload: Record<string, unknown>;
  attempts?: number;
  error?: string | null;
  receivedAt?: Date;
  processedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class WebhookEvent {
  public readonly id: string;
  public readonly provider: string;
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly status: WebhookEventStatus;
  public readonly payload: Record<string, unknown>;
  public readonly attempts: number;
  public readonly error?: string | null;
  public readonly receivedAt: Date;
  public readonly processedAt?: Date | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: CreateWebhookEventProps) {
    if (!props.provider) {
      throw new ValidationError('Webhook event provider is required');
    }
    if (!props.eventId) {
      throw new ValidationError('Webhook event eventId is required');
    }
    if (!props.eventType) {
      throw new ValidationError('Webhook event eventType is required');
    }

    this.id = props.id || WebhookEvent.generateId();
    this.provider = props.provider;
    this.eventId = props.eventId;
    this.eventType = props.eventType;
    this.status = props.status || WebhookEventStatus.RECEIVED;
    this.payload = props.payload || {};
    this.attempts = props.attempts ?? 0;
    this.error = props.error ?? null;
    this.receivedAt = props.receivedAt || new Date();
    this.processedAt = props.processedAt ?? null;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      provider: this.provider,
      eventId: this.eventId,
      eventType: this.eventType,
      status: this.status,
      payload: this.payload,
      attempts: this.attempts,
      error: this.error,
      receivedAt: this.receivedAt.toISOString(),
      processedAt: this.processedAt ? this.processedAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  private static generateId(): string {
    return `whe_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
