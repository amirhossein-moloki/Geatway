import { TicketEvent } from '../domain/entities/ticket-event.entity.js';

export interface ITicketEventRepository {
  create(event: TicketEvent): Promise<TicketEvent>;
  findByTicketId(tenantId: string, ticketId: string): Promise<TicketEvent[]>;
}
