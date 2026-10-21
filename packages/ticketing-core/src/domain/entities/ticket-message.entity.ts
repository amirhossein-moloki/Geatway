import { MessageAuthorRole } from '../enums/message-author-role.enum.js';
import { MessageVisibility } from '../enums/message-visibility.enum.js';
import { TicketAttachment } from './ticket-attachment.entity.js';

export interface TicketMessageProps {
  id: string;
  ticketId: string;
  tenantId: string;
  authorId: string;
  authorRole: MessageAuthorRole;
  content: string;
  visibility: MessageVisibility;
  attachments?: TicketAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export class TicketMessage {
  public readonly id: string;
  public readonly ticketId: string;
  public readonly tenantId: string;
  public readonly authorId: string;
  public readonly authorRole: MessageAuthorRole;
  public readonly content: string;
  public readonly visibility: MessageVisibility;
  public attachments: TicketAttachment[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: TicketMessageProps) {
    this.id = props.id;
    this.ticketId = props.ticketId;
    this.tenantId = props.tenantId;
    this.authorId = props.authorId;
    this.authorRole = props.authorRole;
    this.content = props.content;
    this.visibility = props.visibility;
    this.attachments = props.attachments ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(
    id: string,
    ticketId: string,
    tenantId: string,
    authorId: string,
    authorRole: MessageAuthorRole,
    content: string,
    visibility = MessageVisibility.PUBLIC,
    attachments: TicketAttachment[] = [],
  ): TicketMessage {
    const now = new Date();
    return new TicketMessage({
      id,
      ticketId,
      tenantId,
      authorId,
      authorRole,
      content,
      visibility,
      attachments,
      createdAt: now,
      updatedAt: now,
    });
  }
}
