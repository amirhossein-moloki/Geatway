import { TicketAttachment } from '../domain/entities/ticket-attachment.entity.js';

export interface ITicketAttachmentRepository {
  create(attachment: TicketAttachment): Promise<TicketAttachment>;
  findByMessageId(tenantId: string, messageId: string): Promise<TicketAttachment[]>;
  findById(tenantId: string, id: string): Promise<TicketAttachment | null>;
}
