import { TicketMessage } from '../domain/entities/ticket-message.entity.js';

export interface ITicketMessageRepository {
  create(message: TicketMessage): Promise<TicketMessage>;
  findByTicketId(
    tenantId: string,
    ticketId: string,
    includeInternal: boolean,
  ): Promise<TicketMessage[]>;
  findById(tenantId: string, id: string): Promise<TicketMessage | null>;
}
