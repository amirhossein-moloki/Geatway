export interface TicketReadStateProps {
  tenantId: string;
  ticketId: string;
  userId: string;
  lastReadAt: Date;
  updatedAt: Date;
}

export class TicketReadState {
  public readonly tenantId: string;
  public readonly ticketId: string;
  public readonly userId: string;
  public lastReadAt: Date;
  public updatedAt: Date;

  constructor(props: TicketReadStateProps) {
    this.tenantId = props.tenantId;
    this.ticketId = props.ticketId;
    this.userId = props.userId;
    this.lastReadAt = props.lastReadAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(
    tenantId: string,
    ticketId: string,
    userId: string,
    lastReadAt = new Date(),
  ): TicketReadState {
    const now = new Date();
    return new TicketReadState({
      tenantId,
      ticketId,
      userId,
      lastReadAt,
      updatedAt: now,
    });
  }

  public markRead(readAt = new Date()): void {
    this.lastReadAt = readAt;
    this.updatedAt = new Date();
  }
}
