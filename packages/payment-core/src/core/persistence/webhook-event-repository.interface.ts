import { WebhookEvent } from '../domain/webhook/webhook-event.entity.js';

export interface WebhookEventRepository {
  create(event: WebhookEvent): Promise<WebhookEvent>;
  findById(id: string): Promise<WebhookEvent | null>;
  findByProviderAndEventId(provider: string, eventId: string): Promise<WebhookEvent | null>;
  update(event: WebhookEvent): Promise<WebhookEvent>;
  listPendingOrFailed(maxAttempts?: number, limit?: number): Promise<WebhookEvent[]>;
}
