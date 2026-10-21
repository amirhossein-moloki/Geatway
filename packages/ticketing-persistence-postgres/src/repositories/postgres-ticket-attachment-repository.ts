import { ITicketAttachmentRepository, TicketAttachment } from '@amirhossein-moloki/ticketing-core';
import { PgExecutor } from '../migrator.js';

export interface TicketAttachmentRow {
  id: string;
  ticket_id: string;
  message_id: string;
  tenant_id: string;
  file_name: string;
  file_key: string;
  mime_type: string;
  file_size_bytes: string | number;
  created_at: Date;
}

export class PostgresTicketAttachmentRepository implements ITicketAttachmentRepository {
  constructor(private readonly db: PgExecutor) {}

  private mapRowToAttachment(row: TicketAttachmentRow): TicketAttachment {
    return new TicketAttachment({
      id: row.id,
      ticketId: row.ticket_id,
      messageId: row.message_id,
      tenantId: row.tenant_id,
      fileName: row.file_name,
      fileKey: row.file_key,
      mimeType: row.mime_type,
      fileSizeBytes: Number(row.file_size_bytes),
      createdAt: new Date(row.created_at),
    });
  }

  async create(attachment: TicketAttachment): Promise<TicketAttachment> {
    const res = await this.db.query<TicketAttachmentRow>(
      `INSERT INTO ticket_attachments (
        id, ticket_id, message_id, tenant_id, file_name, file_key, mime_type, file_size_bytes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        attachment.id,
        attachment.ticketId,
        attachment.messageId,
        attachment.tenantId,
        attachment.fileName,
        attachment.fileKey,
        attachment.mimeType,
        attachment.fileSizeBytes,
        attachment.createdAt,
      ],
    );
    return this.mapRowToAttachment(res.rows[0]!);
  }

  async findByMessageId(tenantId: string, messageId: string): Promise<TicketAttachment[]> {
    const res = await this.db.query<TicketAttachmentRow>(
      `SELECT * FROM ticket_attachments WHERE tenant_id = $1 AND message_id = $2 ORDER BY created_at ASC`,
      [tenantId, messageId],
    );
    return res.rows.map((r) => this.mapRowToAttachment(r));
  }

  async findById(tenantId: string, id: string): Promise<TicketAttachment | null> {
    const res = await this.db.query<TicketAttachmentRow>(
      `SELECT * FROM ticket_attachments WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToAttachment(res.rows[0]!);
  }
}
