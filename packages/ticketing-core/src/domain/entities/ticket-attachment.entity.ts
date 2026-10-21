export interface TicketAttachmentProps {
  id: string;
  ticketId: string;
  messageId: string;
  tenantId: string;
  fileName: string;
  fileKey: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: Date;
}

export class TicketAttachment {
  public readonly id: string;
  public readonly ticketId: string;
  public readonly messageId: string;
  public readonly tenantId: string;
  public readonly fileName: string;
  public readonly fileKey: string;
  public readonly mimeType: string;
  public readonly fileSizeBytes: number;
  public readonly createdAt: Date;

  constructor(props: TicketAttachmentProps) {
    this.id = props.id;
    this.ticketId = props.ticketId;
    this.messageId = props.messageId;
    this.tenantId = props.tenantId;
    this.fileName = props.fileName;
    this.fileKey = props.fileKey;
    this.mimeType = props.mimeType;
    this.fileSizeBytes = props.fileSizeBytes;
    this.createdAt = props.createdAt;
  }

  public static create(
    id: string,
    ticketId: string,
    messageId: string,
    tenantId: string,
    fileName: string,
    fileKey: string,
    mimeType: string,
    fileSizeBytes: number,
  ): TicketAttachment {
    return new TicketAttachment({
      id,
      ticketId,
      messageId,
      tenantId,
      fileName,
      fileKey,
      mimeType,
      fileSizeBytes,
      createdAt: new Date(),
    });
  }
}
