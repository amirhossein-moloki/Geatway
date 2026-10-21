import {
  ITicketRepository,
  Ticket,
  TicketFilterOptions,
  TicketPriority,
  TicketStatus,
} from '@amirhossein-moloki/ticketing-core';
import { PgExecutor } from '../migrator.js';

export interface TicketRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category_id: string | null;
  customer_id: string;
  assigned_agent_id: string | null;
  assigned_team_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, unknown> | string;
  created_at: Date;
  updated_at: Date;
  first_response_at: Date | null;
  last_response_at: Date | null;
  resolved_at: Date | null;
  closed_at: Date | null;
}

export class PostgresTicketRepository implements ITicketRepository {
  constructor(private readonly db: PgExecutor) {}

  private mapRowToTicket(row: TicketRow): Ticket {
    let metadataObj: Record<string, unknown> = {};
    if (typeof row.metadata === 'string') {
      try {
        metadataObj = JSON.parse(row.metadata);
      } catch {
        metadataObj = {};
      }
    } else if (row.metadata && typeof row.metadata === 'object') {
      metadataObj = row.metadata;
    }

    return new Ticket({
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description,
      status: row.status as TicketStatus,
      priority: row.priority as TicketPriority,
      categoryId: row.category_id ?? undefined,
      customerId: row.customer_id,
      assignedAgentId: row.assigned_agent_id ?? undefined,
      assignedTeamId: row.assigned_team_id ?? undefined,
      relatedEntity:
        row.related_entity_type && row.related_entity_id
          ? { entityType: row.related_entity_type, entityId: row.related_entity_id }
          : undefined,
      metadata: metadataObj,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      firstResponseAt: row.first_response_at ? new Date(row.first_response_at) : undefined,
      lastResponseAt: row.last_response_at ? new Date(row.last_response_at) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
    });
  }

  async create(ticket: Ticket): Promise<Ticket> {
    const res = await this.db.query<TicketRow>(
      `INSERT INTO tickets (
        id, tenant_id, title, description, status, priority, category_id,
        customer_id, assigned_agent_id, assigned_team_id, related_entity_type,
        related_entity_id, metadata, created_at, updated_at,
        first_response_at, last_response_at, resolved_at, closed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        ticket.id,
        ticket.tenantId,
        ticket.title,
        ticket.description,
        ticket.status,
        ticket.priority,
        ticket.categoryId ?? null,
        ticket.customerId,
        ticket.assignedAgentId ?? null,
        ticket.assignedTeamId ?? null,
        ticket.relatedEntity?.entityType ?? null,
        ticket.relatedEntity?.entityId ?? null,
        JSON.stringify(ticket.metadata ?? {}),
        ticket.createdAt,
        ticket.updatedAt,
        ticket.firstResponseAt ?? null,
        ticket.lastResponseAt ?? null,
        ticket.resolvedAt ?? null,
        ticket.closedAt ?? null,
      ],
    );
    return this.mapRowToTicket(res.rows[0]!);
  }

  async findById(tenantId: string, id: string): Promise<Ticket | null> {
    const res = await this.db.query<TicketRow>(
      `SELECT * FROM tickets WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToTicket(res.rows[0]!);
  }

  async update(ticket: Ticket): Promise<Ticket> {
    const res = await this.db.query<TicketRow>(
      `UPDATE tickets
       SET title = $3, description = $4, status = $5, priority = $6, category_id = $7,
           assigned_agent_id = $8, assigned_team_id = $9, related_entity_type = $10,
           related_entity_id = $11, metadata = $12, updated_at = $13,
           first_response_at = $14, last_response_at = $15, resolved_at = $16, closed_at = $17
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [
        ticket.tenantId,
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.status,
        ticket.priority,
        ticket.categoryId ?? null,
        ticket.assignedAgentId ?? null,
        ticket.assignedTeamId ?? null,
        ticket.relatedEntity?.entityType ?? null,
        ticket.relatedEntity?.entityId ?? null,
        JSON.stringify(ticket.metadata ?? {}),
        ticket.updatedAt,
        ticket.firstResponseAt ?? null,
        ticket.lastResponseAt ?? null,
        ticket.resolvedAt ?? null,
        ticket.closedAt ?? null,
      ],
    );

    if (res.rows.length === 0) {
      throw new Error(`Ticket '${ticket.id}' not found for tenant '${ticket.tenantId}'`);
    }

    return this.mapRowToTicket(res.rows[0]!);
  }

  async findMany(
    tenantId: string,
    filter: TicketFilterOptions,
  ): Promise<{ items: Ticket[]; total: number }> {
    const whereClauses: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (filter.customerId) {
      whereClauses.push(`customer_id = $${paramIdx++}`);
      params.push(filter.customerId);
    }

    if (filter.unassignedOnly) {
      whereClauses.push(`assigned_agent_id IS NULL AND assigned_team_id IS NULL`);
    } else {
      if (filter.assignedAgentId) {
        whereClauses.push(`assigned_agent_id = $${paramIdx++}`);
        params.push(filter.assignedAgentId);
      }

      if (filter.assignedTeamId) {
        whereClauses.push(`assigned_team_id = $${paramIdx++}`);
        params.push(filter.assignedTeamId);
      } else if (filter.teamIds && filter.teamIds.length > 0) {
        whereClauses.push(`assigned_team_id = ANY($${paramIdx++})`);
        params.push(filter.teamIds);
      }
    }

    if (filter.categoryId) {
      whereClauses.push(`category_id = $${paramIdx++}`);
      params.push(filter.categoryId);
    }

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      whereClauses.push(`status = ANY($${paramIdx++})`);
      params.push(statuses);
    }

    if (filter.priority) {
      const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
      whereClauses.push(`priority = ANY($${paramIdx++})`);
      params.push(priorities);
    }

    if (filter.searchQuery) {
      whereClauses.push(`(title ILIKE $${paramIdx} OR description ILIKE $${paramIdx})`);
      params.push(`%${filter.searchQuery}%`);
      paramIdx++;
    }

    if (filter.createdAfter) {
      whereClauses.push(`created_at >= $${paramIdx++}`);
      params.push(filter.createdAfter);
    }

    if (filter.createdBefore) {
      whereClauses.push(`created_at <= $${paramIdx++}`);
      params.push(filter.createdBefore);
    }

    if (filter.overdueOnly) {
      whereClauses.push(
        `status NOT IN ('RESOLVED', 'CLOSED') AND first_response_at IS NULL AND created_at < NOW() - INTERVAL '1 hour' * COALESCE($${paramIdx++}, CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 4 WHEN 'MEDIUM' THEN 24 WHEN 'LOW' THEN 48 ELSE 24 END)`,
      );
      params.push(filter.slaResponseHours ?? null);
    }

    const whereSql = whereClauses.join(' AND ');

    const countRes = await this.db.query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM tickets WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

    let sortColumn = 'created_at';
    if (filter.sortBy === 'updatedAt') sortColumn = 'updated_at';
    if (filter.sortBy === 'priority') sortColumn = 'priority';
    if (filter.sortBy === 'status') sortColumn = 'status';

    const order = filter.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    let querySql = `SELECT * FROM tickets WHERE ${whereSql} ORDER BY ${sortColumn} ${order}`;

    if (filter.limit) {
      querySql += ` LIMIT $${paramIdx++}`;
      params.push(filter.limit);
    }

    if (filter.offset) {
      querySql += ` OFFSET $${paramIdx++}`;
      params.push(filter.offset);
    }

    const res = await this.db.query<TicketRow>(querySql, params);
    const items = res.rows.map((r) => this.mapRowToTicket(r));

    return { items, total };
  }
}
