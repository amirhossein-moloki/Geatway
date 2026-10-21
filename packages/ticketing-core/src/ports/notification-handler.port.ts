import { Ticket } from '../domain/entities/ticket.entity.js';
import { TicketMessage } from '../domain/entities/ticket-message.entity.js';
import { TicketAssignment } from '../domain/entities/ticket-assignment.entity.js';
import { TicketStatus } from '../domain/enums/ticket-status.enum.js';

export interface INotificationHandler {
  notifyTicketCreated(ticket: Ticket): Promise<void>;
  notifyStatusChanged(ticket: Ticket, previousStatus: TicketStatus): Promise<void>;
  notifyMessageAdded(ticket: Ticket, message: TicketMessage): Promise<void>;
  notifyTicketAssigned(ticket: Ticket, assignment: TicketAssignment): Promise<void>;
}
