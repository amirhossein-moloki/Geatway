import { TicketingEventType } from '../enums/ticketing-event-type.enum.js';

export interface TicketEventProps {
  id: string;
  ticketId: string;
  tenantId: string;
  eventType: TicketingEventType;
  actorId: string;
  actorRole: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
}

export class TicketEvent {
  public readonly id: string;
  public readonly ticketId: string;
  public readonly tenantId: string;
  public readonly eventType: TicketingEventType;
  public readonly actorId: string;
  public readonly actorRole: string;
  public readonly payload?: Record<string, unknown>;
  public readonly createdAt: Date;

  constructor(props: TicketEventProps) {
    this.id = props.id;
    this.ticketId = props.ticketId;
    this.tenantId = props.tenantId;
    this.eventType = props.eventType;
    this.actorId = props.actorId;
    this.actorRole = props.actorRole;
    this.payload = props.payload;
    this.createdAt = props.createdAt;
  }

  public static create(
    id: string,
    ticketId: string,
    tenantId: string,
    eventType: TicketingEventType,
    actorId: string,
    actorRole: string,
    payload?: Record<string, unknown>,
  ): TicketEvent {
    return new TicketEvent({
      id,
      ticketId,
      tenantId,
      eventType,
      actorId,
      actorRole,
      payload,
      createdAt: new Date(),
    });
  }
}
