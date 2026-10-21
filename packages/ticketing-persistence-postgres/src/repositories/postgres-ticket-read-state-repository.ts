import { ITicketReadStateRepository } from '@amirhossein-moloki/ticketing-core';
import { PgExecutor } from '../migrator.js';

export class PostgresTicketReadStateRepository implements ITicketReadStateRepository {
  constructor(private readonly db: PgExecutor) {}

  async markAsRead(tenantId: string, ticketId: string, userId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO ticket_read_states (tenant_id, ticket_id, user_id, last_read_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, ticket_id, user_id)
       DO UPDATE SET last_read_at = NOW()`,
      [tenantId, ticketId, userId],
    );
  }

  async getLastReadAt(tenantId: string, ticketId: string, userId: string): Promise<Date | null> {
    const res = await this.db.query<{ last_read_at: Date }>(
      `SELECT last_read_at FROM ticket_read_states WHERE tenant_id = $1 AND ticket_id = $2 AND user_id = $3`,
      [tenantId, ticketId, userId],
    );
    if (res.rows.length === 0) return null;
    return new Date(res.rows[0]!.last_read_at);
  }

  async getUnreadCount(
    tenantId: string,
    ticketId: string,
    userId: string,
    lastReadAt: Date | null,
    includeInternal = false,
  ): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ticket_messages WHERE tenant_id = $1 AND ticket_id = $2 AND author_id != $3`;
    const params: unknown[] = [tenantId, ticketId, userId];
    let paramIdx = 4;

    if (!includeInternal) {
      sql += ` AND visibility = $${paramIdx++}`;
      params.push('PUBLIC');
    }

    if (lastReadAt) {
      sql += ` AND created_at > $${paramIdx++}`;
      params.push(lastReadAt);
    }

    const res = await this.db.query<{ count: string | number }>(sql, params);
    return Number(res.rows[0]?.count ?? 0);
  }

  async getUnreadCountForUser(
    tenantId: string,
    userId: string,
    includeInternal = false,
  ): Promise<number> {
    let sql = `SELECT COUNT(*) as count
       FROM ticket_messages tm
       LEFT JOIN ticket_read_states trs
         ON tm.tenant_id = trs.tenant_id AND tm.ticket_id = trs.ticket_id AND trs.user_id = $2
       WHERE tm.tenant_id = $1
         AND tm.author_id != $2
         AND (trs.last_read_at IS NULL OR tm.created_at > trs.last_read_at)`;
    const params: unknown[] = [tenantId, userId];

    if (!includeInternal) {
      sql += ` AND tm.visibility = 'PUBLIC'`;
    }

    const res = await this.db.query<{ count: string | number }>(sql, params);
    return Number(res.rows[0]?.count ?? 0);
  }
}
