export interface TicketAssignmentProps {
  id: string;
  ticketId: string;
  tenantId: string;
  assignedAgentId?: string;
  assignedTeamId?: string;
  assignedBy: string;
  assignedAt: Date;
  previousAgentId?: string;
}

export class TicketAssignment {
  public readonly id: string;
  public readonly ticketId: string;
  public readonly tenantId: string;
  public readonly assignedAgentId?: string;
  public readonly assignedTeamId?: string;
  public readonly assignedBy: string;
  public readonly assignedAt: Date;
  public readonly previousAgentId?: string;

  constructor(props: TicketAssignmentProps) {
    this.id = props.id;
    this.ticketId = props.ticketId;
    this.tenantId = props.tenantId;
    this.assignedAgentId = props.assignedAgentId;
    this.assignedTeamId = props.assignedTeamId;
    this.assignedBy = props.assignedBy;
    this.assignedAt = props.assignedAt;
    this.previousAgentId = props.previousAgentId;
  }

  public static create(
    id: string,
    ticketId: string,
    tenantId: string,
    assignedBy: string,
    assignedAgentId?: string,
    assignedTeamId?: string,
    previousAgentId?: string,
  ): TicketAssignment {
    return new TicketAssignment({
      id,
      ticketId,
      tenantId,
      assignedBy,
      assignedAgentId,
      assignedTeamId,
      previousAgentId,
      assignedAt: new Date(),
    });
  }
}
