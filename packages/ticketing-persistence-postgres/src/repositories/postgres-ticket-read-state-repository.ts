import { ITicketReadStateRepository, TicketReadState } from '@amirhossein-moloki/ticketing-core';
import { PgExecutor } from '../migrator.js';

export interface TicketReadStateRow {
  tenant_id: string;
  ticket_id: string;
  user_id: string;
  last_read_at: Date;
  updated_at: Date;
}

export class PostgresTicketReadStateRepository implements ITicketReadStateRepository {
  constructor(private readonly db: PgExecutor) {}

  private mapRowToReadState(row: TicketReadStateRow): TicketReadState {
    return new TicketReadState({
      tenantId: row.tenant_id,
      ticketId: row.ticket_id,
      userId: row.user_id,
      lastReadAt: new Date(row.last_read_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async upsert(readState: TicketReadState): Promise<TicketReadState> {
    const res = await this.db.query<TicketReadStateRow>(
      `INSERT INTO ticket_read_states (tenant_id, ticket_id, user_id, last_read_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, ticket_id, user_id)
       DO UPDATE SET last_read_at = EXCLUDED.last_read_at, updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        readState.tenantId,
        readState.ticketId,
        readState.userId,
        readState.lastReadAt,
        readState.updatedAt,
      ],
    );
    return this.mapRowToReadState(res.rows[0]!);
  }

  async findByUserAndTicket(
    tenantId: string,
    userId: string,
    ticketId: string,
  ): Promise<TicketReadState | null> {
    const res = await this.db.query<TicketReadStateRow>(
      `SELECT * FROM ticket_read_states WHERE tenant_id = $1 AND user_id = $2 AND ticket_id = $3`,
      [tenantId, userId, ticketId],
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToReadState(res.rows[0]!);
  }

  async getUnreadCount(tenantId: string, userId: string, isCustomer: boolean): Promise<number> {
    if (isCustomer) {
      const res = await this.db.query<{ count: string | number }>(
        `SELECT COUNT(DISTINCT t.id) as count
         FROM tickets t
         JOIN ticket_messages m ON m.tenant_id = t.tenant_id AND m.ticket_id = t.id
         LEFT JOIN ticket_read_states rs ON rs.tenant_id = t.tenant_id AND rs.ticket_id = t.id AND rs.user_id = $2
         WHERE t.tenant_id = $1
           AND t.customer_id = $2
           AND m.author_role != 'CUSTOMER'
           AND m.visibility = 'PUBLIC'
           AND (rs.last_read_at IS NULL OR m.created_at > rs.last_read_at)`,
        [tenantId, userId],
      );
      return Number(res.rows[0]?.count ?? 0);
    } else {
      const res = await this.db.query<{ count: string | number }>(
        `SELECT COUNT(DISTINCT t.id) as count
         FROM tickets t
         JOIN ticket_messages m ON m.tenant_id = t.tenant_id AND m.ticket_id = t.id
         LEFT JOIN ticket_read_states rs ON rs.tenant_id = t.tenant_id AND rs.ticket_id = t.id AND rs.user_id = $2
         WHERE t.tenant_id = $1
           AND (t.assigned_agent_id = $2 OR t.assigned_agent_id IS NULL)
           AND m.author_role = 'CUSTOMER'
           AND (rs.last_read_at IS NULL OR m.created_at > rs.last_read_at)`,
        [tenantId, userId],
      );
      return Number(res.rows[0]?.count ?? 0);
    }
  }
}
