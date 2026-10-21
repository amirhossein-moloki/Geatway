import { PaymentPlatformError } from '@amirhossein-moloki/payment-core';

export class TicketingError extends PaymentPlatformError {
  public override readonly code: string = 'TICKETING_ERROR';

  constructor(
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, statusCode, details, cause);
  }
}

export class TicketNotFoundError extends TicketingError {
  public override readonly code: string = 'TICKET_NOT_FOUND_ERROR';

  constructor(ticketId: string, tenantId?: string, details?: Record<string, unknown>) {
    super(`Ticket '${ticketId}' was not found`, 404, { ...details, ticketId, tenantId });
  }
}

export class TenantMismatchError extends TicketingError {
  public override readonly code: string = 'TENANT_MISMATCH_ERROR';

  constructor(expectedTenantId: string, actualTenantId: string, details?: Record<string, unknown>) {
    super(
      `Access denied: tenant mismatch (expected '${expectedTenantId}', got '${actualTenantId}')`,
      403,
      { ...details, expectedTenantId, actualTenantId },
    );
  }
}

export class UnauthorizedAccessError extends TicketingError {
  public override readonly code: string = 'UNAUTHORIZED_ACCESS_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 403, details);
  }
}

export class InvalidTicketStateError extends TicketingError {
  public override readonly code: string = 'INVALID_TICKET_STATE_ERROR';

  constructor(currentStatus: string, targetStatus: string, details?: Record<string, unknown>) {
    super(`Invalid ticket status transition from '${currentStatus}' to '${targetStatus}'`, 400, {
      ...details,
      currentStatus,
      targetStatus,
    });
  }
}

export class InvalidCategoryError extends TicketingError {
  public override readonly code: string = 'INVALID_CATEGORY_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, details);
  }
}

export class AttachmentNotFoundError extends TicketingError {
  public override readonly code: string = 'ATTACHMENT_NOT_FOUND_ERROR';

  constructor(attachmentId: string, details?: Record<string, unknown>) {
    super(`Attachment '${attachmentId}' was not found`, 404, { ...details, attachmentId });
  }
}

export class InvalidTenancyConfigError extends TicketingError {
  public override readonly code: string = 'INVALID_TENANCY_CONFIG_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, details);
  }
}
