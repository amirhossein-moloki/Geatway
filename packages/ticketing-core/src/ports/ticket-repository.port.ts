import { Ticket } from '../domain/entities/ticket.entity.js';
import { TicketPriority } from '../domain/enums/ticket-priority.enum.js';
import { TicketStatus } from '../domain/enums/ticket-status.enum.js';

export interface TicketFilterOptions {
  requesterId?: string;
  customerId?: string;
  assignedAgentId?: string;
  assignedTeamId?: string;
  teamIds?: string[];
  unassignedOnly?: boolean;
  overdueOnly?: boolean;
  slaResponseHours?: number;
  status?: TicketStatus | TicketStatus[];
  priority?: TicketPriority | TicketPriority[];
  categoryId?: string;
  searchQuery?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

export interface ITicketRepository {
  create(ticket: Ticket): Promise<Ticket>;
  findById(tenantId: string, id: string): Promise<Ticket | null>;
  update(ticket: Ticket): Promise<Ticket>;
  findMany(
    tenantId: string,
    filter: TicketFilterOptions,
  ): Promise<{ items: Ticket[]; total: number }>;
}
