import { TicketAssignment } from '../domain/entities/ticket-assignment.entity.js';

export interface ITicketAssignmentRepository {
  create(assignment: TicketAssignment): Promise<TicketAssignment>;
  findByTicketId(tenantId: string, ticketId: string): Promise<TicketAssignment[]>;
}
