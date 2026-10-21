import { TicketReadState } from '../domain/entities/ticket-read-state.entity.js';

export interface ITicketReadStateRepository {
  upsert(readState: TicketReadState): Promise<TicketReadState>;
  findByUserAndTicket(tenantId: string, userId: string, ticketId: string): Promise<TicketReadState | null>;
  getUnreadCount(tenantId: string, userId: string, isCustomer: boolean): Promise<number>;
}
