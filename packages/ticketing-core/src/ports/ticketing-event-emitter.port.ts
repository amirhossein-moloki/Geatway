import { TicketEvent } from '../domain/entities/ticket-event.entity.js';

export interface ITicketingEventEmitter {
  emit(event: TicketEvent): Promise<void>;
}
