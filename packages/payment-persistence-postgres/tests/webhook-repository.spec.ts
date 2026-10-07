import { describe, it, expect, beforeEach } from 'vitest';
import {
  WebhookEvent,
  WebhookEventStatus,
  PersistenceConflictError,
} from '@amirhossein-moloki/payment-core';
import { PostgresWebhookEventRepository } from '../src/repositories/postgres-webhook-event-repository.js';
import { createTestDatabase } from './test-utils.js';
import { PgExecutor } from '../src/migrator.js';

describe('PostgresWebhookEventRepository', () => {
  let db: PgExecutor;
  let webhookRepo: PostgresWebhookEventRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    webhookRepo = new PostgresWebhookEventRepository(db);
  });

  it('should create and retrieve a webhook event by provider and event ID', async () => {
    const event = new WebhookEvent({
      provider: 'stripe',
      eventId: 'evt_123456789',
      eventType: 'payment_intent.succeeded',
      payload: { id: 'pi_123', amount: 5000, currency: 'usd' },
    });

    const created = await webhookRepo.create(event);
    expect(created.id).toBe(event.id);
    expect(created.provider).toBe('stripe');
    expect(created.eventId).toBe('evt_123456789');
    expect(created.status).toBe(WebhookEventStatus.RECEIVED);
    expect(created.payload.id).toBe('pi_123');

    const found = await webhookRepo.findByProviderAndEventId('stripe', 'evt_123456789');
    expect(found).not.toBeNull();
    expect(found?.eventType).toBe('payment_intent.succeeded');
  });

  it('should enforce unique constraint on provider + event_id (deduplication)', async () => {
    const event1 = new WebhookEvent({
      provider: 'stripe',
      eventId: 'evt_duplicate_id',
      eventType: 'payment_intent.succeeded',
      payload: { id: 'pi_1' },
    });
    await webhookRepo.create(event1);

    const eventDuplicate = new WebhookEvent({
      provider: 'stripe',
      eventId: 'evt_duplicate_id',
      eventType: 'payment_intent.succeeded',
      payload: { id: 'pi_1' },
    });

    await expect(webhookRepo.create(eventDuplicate)).rejects.toThrow(PersistenceConflictError);
  });

  it('should update webhook processing state machine and attempts', async () => {
    const event = new WebhookEvent({
      provider: 'adyen',
      eventId: 'adyen_evt_001',
      eventType: 'NOTIFICATION',
      payload: { pspReference: 'PSP_999' },
    });
    await webhookRepo.create(event);

    // Transition to PROCESSING
    const processingEvent = new WebhookEvent({
      id: event.id,
      provider: event.provider,
      eventId: event.eventId,
      eventType: event.eventType,
      status: WebhookEventStatus.PROCESSING,
      payload: event.payload,
      attempts: 1,
    });
    await webhookRepo.update(processingEvent);

    let reloaded = await webhookRepo.findById(event.id);
    expect(reloaded?.status).toBe(WebhookEventStatus.PROCESSING);
    expect(reloaded?.attempts).toBe(1);

    // Transition to PROCESSED
    const processedEvent = new WebhookEvent({
      id: event.id,
      provider: event.provider,
      eventId: event.eventId,
      eventType: event.eventType,
      status: WebhookEventStatus.PROCESSED,
      payload: event.payload,
      attempts: 1,
      processedAt: new Date(),
    });
    await webhookRepo.update(processedEvent);

    reloaded = await webhookRepo.findById(event.id);
    expect(reloaded?.status).toBe(WebhookEventStatus.PROCESSED);
    expect(reloaded?.processedAt).not.toBeNull();
  });

  it('should list pending or failed webhook events for retry processing', async () => {
    const eReceived = new WebhookEvent({
      provider: 'stripe',
      eventId: 'evt_rec',
      eventType: 'charge.failed',
      payload: {},
      status: WebhookEventStatus.RECEIVED,
      attempts: 0,
    });
    const eFailed = new WebhookEvent({
      provider: 'stripe',
      eventId: 'evt_fail',
      eventType: 'charge.failed',
      payload: {},
      status: WebhookEventStatus.FAILED,
      attempts: 2,
      error: 'Network timeout',
    });
    const eProcessed = new WebhookEvent({
      provider: 'stripe',
      eventId: 'evt_ok',
      eventType: 'charge.succeeded',
      payload: {},
      status: WebhookEventStatus.PROCESSED,
      attempts: 1,
    });

    await webhookRepo.create(eReceived);
    await webhookRepo.create(eFailed);
    await webhookRepo.create(eProcessed);

    const retryList = await webhookRepo.listPendingOrFailed(5);
    expect(retryList.length).toBe(2);
    const eventIds = retryList.map((e) => e.eventId);
    expect(eventIds).toContain('evt_rec');
    expect(eventIds).toContain('evt_fail');
    expect(eventIds).not.toContain('evt_ok');
  });
});
