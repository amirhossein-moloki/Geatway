import {
  ITicketMessageRepository,
  MessageAuthorRole,
  MessageVisibility,
  TicketAttachment,
  TicketMessage,
} from '@amirhossein-moloki/ticketing-core';
import { PgExecutor } from '../migrator.js';
import { TicketAttachmentRow } from './postgres-ticket-attachment-repository.js';

export interface TicketMessageRow {
  id: string;
  ticket_id: string;
  tenant_id: string;
  author_id: string;
  author_role: string;
  content: string;
  visibility: string;
  created_at: Date;
  updated_at: Date;
}

export class PostgresTicketMessageRepository implements ITicketMessageRepository {
  constructor(private readonly db: PgExecutor) {}

  private mapRowToMessage(
    row: TicketMessageRow,
    attachments: TicketAttachment[] = [],
  ): TicketMessage {
    return new TicketMessage({
      id: row.id,
      ticketId: row.ticket_id,
      tenantId: row.tenant_id,
      authorId: row.author_id,
      authorRole: row.author_role as MessageAuthorRole,
      content: row.content,
      visibility: row.visibility as MessageVisibility,
      attachments,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async create(message: TicketMessage): Promise<TicketMessage> {
    const res = await this.db.query<TicketMessageRow>(
      `INSERT INTO ticket_messages (
        id, ticket_id, tenant_id, author_id, author_role, content, visibility, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        message.id,
        message.ticketId,
        message.tenantId,
        message.authorId,
        message.authorRole,
        message.content,
        message.visibility,
        message.createdAt,
        message.updatedAt,
      ],
    );
    return this.mapRowToMessage(res.rows[0]!, message.attachments);
  }

  async findByTicketId(
    tenantId: string,
    ticketId: string,
    includeInternal: boolean,
  ): Promise<TicketMessage[]> {
    let sql = `SELECT * FROM ticket_messages WHERE tenant_id = $1 AND ticket_id = $2`;
    const params: unknown[] = [tenantId, ticketId];
    if (!includeInternal) {
      sql += ` AND visibility = $3`;
      params.push(MessageVisibility.PUBLIC);
    }
    sql += ` ORDER BY created_at ASC`;

    const msgRes = await this.db.query<TicketMessageRow>(sql, params);
    if (msgRes.rows.length === 0) return [];

    const messageIds = msgRes.rows.map((r) => r.id);
    const attRes = await this.db.query<TicketAttachmentRow>(
      `SELECT * FROM ticket_attachments WHERE tenant_id = $1 AND message_id = ANY($2)`,
      [tenantId, messageIds],
    );

    const attachmentsByMsgId = new Map<string, TicketAttachment[]>();
    for (const attRow of attRes.rows) {
      const att = new TicketAttachment({
        id: attRow.id,
        ticketId: attRow.ticket_id,
        messageId: attRow.message_id,
        tenantId: attRow.tenant_id,
        fileName: attRow.file_name,
        fileKey: attRow.file_key,
        mimeType: attRow.mime_type,
        fileSizeBytes: Number(attRow.file_size_bytes),
        createdAt: new Date(attRow.created_at),
      });

      const list = attachmentsByMsgId.get(attRow.message_id) ?? [];
      list.push(att);
      attachmentsByMsgId.set(attRow.message_id, list);
    }

    return msgRes.rows.map((r) => this.mapRowToMessage(r, attachmentsByMsgId.get(r.id) ?? []));
  }

  async findById(tenantId: string, id: string): Promise<TicketMessage | null> {
    const res = await this.db.query<TicketMessageRow>(
      `SELECT * FROM ticket_messages WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    if (res.rows.length === 0) return null;

    const attRes = await this.db.query<TicketAttachmentRow>(
      `SELECT * FROM ticket_attachments WHERE tenant_id = $1 AND message_id = $2`,
      [tenantId, id],
    );

    const attachments = attRes.rows.map(
      (attRow) =>
        new TicketAttachment({
          id: attRow.id,
          ticketId: attRow.ticket_id,
          messageId: attRow.message_id,
          tenantId: attRow.tenant_id,
          fileName: attRow.file_name,
          fileKey: attRow.file_key,
          mimeType: attRow.mime_type,
          fileSizeBytes: Number(attRow.file_size_bytes),
          createdAt: new Date(attRow.created_at),
        }),
    );

    return this.mapRowToMessage(res.rows[0]!, attachments);
  }
}
