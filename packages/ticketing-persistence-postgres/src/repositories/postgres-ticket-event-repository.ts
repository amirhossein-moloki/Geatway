import {
  ITicketEventRepository,
  TicketEvent,
  TicketingEventType,
} from '@amirhossein-moloki/ticketing-core';
import { PgExecutor } from '../migrator.js';

export interface TicketEventRow {
  id: string;
  ticket_id: string;
  tenant_id: string;
  event_type: string;
  actor_id: string;
  actor_role: string;
  payload: Record<string, unknown> | string | null;
  created_at: Date;
}

export class PostgresTicketEventRepository implements ITicketEventRepository {
  constructor(private readonly db: PgExecutor) {}

  private mapRowToEvent(row: TicketEventRow): TicketEvent {
    let payloadObj: Record<string, unknown> | undefined = undefined;
    if (typeof row.payload === 'string') {
      try {
        payloadObj = JSON.parse(row.payload);
      } catch {
        payloadObj = undefined;
      }
    } else if (row.payload && typeof row.payload === 'object') {
      payloadObj = row.payload;
    }

    return new TicketEvent({
      id: row.id,
      ticketId: row.ticket_id,
      tenantId: row.tenant_id,
      eventType: row.event_type as TicketingEventType,
      actorId: row.actor_id,
      actorRole: row.actor_role,
      payload: payloadObj,
      createdAt: new Date(row.created_at),
    });
  }

  async create(event: TicketEvent): Promise<TicketEvent> {
    const res = await this.db.query<TicketEventRow>(
      `INSERT INTO ticket_events (
        id, ticket_id, tenant_id, event_type, actor_id, actor_role, payload, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        event.id,
        event.ticketId,
        event.tenantId,
        event.eventType,
        event.actorId,
        event.actorRole,
        JSON.stringify(event.payload ?? {}),
        event.createdAt,
      ],
    );
    return this.mapRowToEvent(res.rows[0]!);
  }

  async findByTicketId(tenantId: string, ticketId: string): Promise<TicketEvent[]> {
    const res = await this.db.query<TicketEventRow>(
      `SELECT * FROM ticket_events WHERE tenant_id = $1 AND ticket_id = $2 ORDER BY created_at ASC`,
      [tenantId, ticketId],
    );
    return res.rows.map((r) => this.mapRowToEvent(r));
  }
}
