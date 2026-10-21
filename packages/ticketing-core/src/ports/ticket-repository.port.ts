import { Ticket } from '../domain/entities/ticket.entity.js';
import { TicketPriority } from '../domain/enums/ticket-priority.enum.js';
import { TicketStatus } from '../domain/enums/ticket-status.enum.js';

export interface TicketFilterOptions {
  customerId?: string;
  assignedAgentId?: string;
  assignedTeamId?: string;
  status?: TicketStatus | TicketStatus[];
  priority?: TicketPriority | TicketPriority[];
  categoryId?: string;
  searchQuery?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  unassignedOnly?: boolean;
  isOverdue?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

export interface TenantMetricsOptions {
  startDate?: Date;
  endDate?: Date;
}

export interface TenantMetricsResult {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  waitingForCustomerTickets: number;
  waitingForAgentTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  unassignedTickets: number;
  overdueTickets: number;
  avgFirstResponseTimeMinutes: number | null;
  avgResolutionTimeMinutes: number | null;
  agentWorkload: Array<{ agentId: string; count: number }>;
}

export interface ITicketRepository {
  create(ticket: Ticket): Promise<Ticket>;
  findById(tenantId: string, id: string): Promise<Ticket | null>;
  update(ticket: Ticket): Promise<Ticket>;
  findMany(
    tenantId: string,
    filter: TicketFilterOptions,
  ): Promise<{ items: Ticket[]; total: number }>;
  getMetrics?(tenantId: string, options?: TenantMetricsOptions): Promise<TenantMetricsResult>;
}
