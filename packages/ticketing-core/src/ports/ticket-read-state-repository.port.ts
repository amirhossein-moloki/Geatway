export interface ITicketReadStateRepository {
  markAsRead(tenantId: string, ticketId: string, userId: string): Promise<void>;
  getLastReadAt(tenantId: string, ticketId: string, userId: string): Promise<Date | null>;
  getUnreadCount(
    tenantId: string,
    ticketId: string,
    userId: string,
    lastReadAt: Date | null,
    includeInternal?: boolean,
  ): Promise<number>;
  getUnreadCountForUser(
    tenantId: string,
    userId: string,
    includeInternal?: boolean,
  ): Promise<number>;
}
