import { ITicketAssignmentRepository, TicketAssignment } from '@amirhossein-moloki/ticketing-core';
import { PgExecutor } from '../migrator.js';

export interface TicketAssignmentRow {
  id: string;
  ticket_id: string;
  tenant_id: string;
  assigned_agent_id: string | null;
  assigned_team_id: string | null;
  assigned_by: string;
  assigned_at: Date;
  previous_agent_id: string | null;
}

export class PostgresTicketAssignmentRepository implements ITicketAssignmentRepository {
  constructor(private readonly db: PgExecutor) {}

  private mapRowToAssignment(row: TicketAssignmentRow): TicketAssignment {
    return new TicketAssignment({
      id: row.id,
      ticketId: row.ticket_id,
      tenantId: row.tenant_id,
      assignedAgentId: row.assigned_agent_id ?? undefined,
      assignedTeamId: row.assigned_team_id ?? undefined,
      assignedBy: row.assigned_by,
      assignedAt: new Date(row.assigned_at),
      previousAgentId: row.previous_agent_id ?? undefined,
    });
  }

  async create(assignment: TicketAssignment): Promise<TicketAssignment> {
    const res = await this.db.query<TicketAssignmentRow>(
      `INSERT INTO ticket_assignments (
        id, ticket_id, tenant_id, assigned_agent_id, assigned_team_id, assigned_by, assigned_at, previous_agent_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        assignment.id,
        assignment.ticketId,
        assignment.tenantId,
        assignment.assignedAgentId ?? null,
        assignment.assignedTeamId ?? null,
        assignment.assignedBy,
        assignment.assignedAt,
        assignment.previousAgentId ?? null,
      ],
    );
    return this.mapRowToAssignment(res.rows[0]!);
  }

  async findByTicketId(tenantId: string, ticketId: string): Promise<TicketAssignment[]> {
    const res = await this.db.query<TicketAssignmentRow>(
      `SELECT * FROM ticket_assignments WHERE tenant_id = $1 AND ticket_id = $2 ORDER BY assigned_at ASC`,
      [tenantId, ticketId],
    );
    return res.rows.map((r) => this.mapRowToAssignment(r));
  }
}
