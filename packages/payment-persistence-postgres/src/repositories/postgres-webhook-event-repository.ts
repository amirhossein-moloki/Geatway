import {
  WebhookEvent,
  WebhookEventRepository,
  WebhookEventStatus,
  RepositoryNotFoundError,
} from '@company/payment-core';
import { PgExecutor } from '../migrator.js';
import { mapPgError } from '../error-mapper.js';

export class PostgresWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly executor: PgExecutor) {}

  public async create(event: WebhookEvent): Promise<WebhookEvent> {
    try {
      const sql = `
        INSERT INTO webhook_events (
          id, provider, event_id, event_type, status, payload, attempts,
          error, received_at, processed_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      const values = [
        event.id,
        event.provider,
        event.eventId,
        event.eventType,
        event.status,
        JSON.stringify(event.payload || {}),
        event.attempts,
        event.error ?? null,
        event.receivedAt,
        event.processedAt ?? null,
        event.createdAt,
        event.updatedAt,
      ];

      const res = await this.executor.query(sql, values);
      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapPgError(
        err,
        `Failed to create webhook event provider=${event.provider} eventId=${event.eventId}`,
      );
    }
  }

  public async findById(id: string): Promise<WebhookEvent | null> {
    try {
      const sql = `SELECT * FROM webhook_events WHERE id = $1`;
      const res = await this.executor.query(sql, [id]);

      if (res.rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapPgError(err, `Failed to find webhook event by id ${id}`);
    }
  }

  public async findByProviderAndEventId(
    provider: string,
    eventId: string,
  ): Promise<WebhookEvent | null> {
    try {
      const sql = `SELECT * FROM webhook_events WHERE provider = $1 AND event_id = $2`;
      const res = await this.executor.query(sql, [provider, eventId]);

      if (res.rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      throw mapPgError(err, `Failed to find webhook event provider=${provider} eventId=${eventId}`);
    }
  }

  public async update(event: WebhookEvent): Promise<WebhookEvent> {
    try {
      const updatedAt = new Date();
      const sql = `
        UPDATE webhook_events SET
          status = $1,
          payload = $2,
          attempts = $3,
          error = $4,
          processed_at = $5,
          updated_at = $6
        WHERE id = $7
        RETURNING *
      `;
      const values = [
        event.status,
        JSON.stringify(event.payload || {}),
        event.attempts,
        event.error ?? null,
        event.processedAt ?? null,
        updatedAt,
        event.id,
      ];

      const res = await this.executor.query(sql, values);
      if (res.rows.length === 0) {
        throw new RepositoryNotFoundError('WebhookEvent', event.id);
      }

      return this.mapRowToEntity(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (err instanceof RepositoryNotFoundError) {
        throw err;
      }
      throw mapPgError(err, `Failed to update webhook event ${event.id}`);
    }
  }

  public async listPendingOrFailed(maxAttempts = 5, limit = 50): Promise<WebhookEvent[]> {
    try {
      const sql = `
        SELECT * FROM webhook_events
        WHERE status IN ($1, $2, $3) AND attempts < $4
        ORDER BY created_at ASC
        LIMIT $5
      `;
      const res = await this.executor.query(sql, [
        WebhookEventStatus.RECEIVED,
        WebhookEventStatus.PROCESSING,
        WebhookEventStatus.FAILED,
        maxAttempts,
        limit,
      ]);

      return res.rows.map((row: Record<string, unknown>) => this.mapRowToEntity(row));
    } catch (err) {
      throw mapPgError(err, 'Failed to list pending/failed webhook events');
    }
  }

  private mapRowToEntity(row: Record<string, unknown>): WebhookEvent {
    const rawPayload = row.payload;
    let payload: Record<string, unknown> = {};
    if (typeof rawPayload === 'string') {
      try {
        payload = JSON.parse(rawPayload);
      } catch {
        payload = {};
      }
    } else if (rawPayload && typeof rawPayload === 'object') {
      payload = rawPayload as Record<string, unknown>;
    }

    return new WebhookEvent({
      id: row.id as string,
      provider: row.provider as string,
      eventId: row.event_id as string,
      eventType: row.event_type as string,
      status: row.status as WebhookEventStatus,
      payload,
      attempts: Number(row.attempts),
      error: (row.error as string) || null,
      receivedAt: new Date(row.received_at as string | Date),
      processedAt: row.processed_at ? new Date(row.processed_at as string | Date) : null,
      createdAt: new Date(row.created_at as string | Date),
      updatedAt: new Date(row.updated_at as string | Date),
    });
  }
}
