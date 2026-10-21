import {
  BulkUpdateTicketsInput,
  MessageVisibility,
  TenantContext,
  TicketPriority,
  TicketStatus,
  TicketingService,
  UserRole,
} from '@amirhossein-moloki/ticketing-core';

export interface HttpRequest {
  headers: Record<string, string | undefined>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

export class TicketingHttpController {
  constructor(private readonly ticketingService: TicketingService) {}

  public extractTenantContext(req: HttpRequest): TenantContext {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const userRole = (req.headers['x-user-role'] as UserRole) || 'CUSTOMER';

    if (this.ticketingService.tenancyConfig.mode === 'MULTI_TENANT' && !tenantId) {
      throw new Error('Missing x-tenant-id header');
    }
    if (!userId) {
      throw new Error('Missing x-user-id header');
    }

    return {
      tenantId: tenantId || undefined,
      userId,
      userRole,
    };
  }

  public async handleCreateCategory(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const { name, description } = req.body as { name: string; description?: string };

      const category = await this.ticketingService.createCategory(ctx, { name, description });
      return { status: 201, body: { category } };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleUpdateCategory(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const categoryId = req.params?.categoryId;
      if (!categoryId) {
        return { status: 400, body: { error: 'Missing categoryId' } };
      }
      const { name, description, isActive } = req.body as {
        name?: string;
        description?: string;
        isActive?: boolean;
      };

      const category = await this.ticketingService.updateCategory(ctx, categoryId, {
        name,
        description,
        isActive,
      });
      return { status: 200, body: { category } };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleListCategories(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const activeOnly = req.query?.activeOnly !== 'false';

      const categories = await this.ticketingService.listCategories(ctx, activeOnly);
      return { status: 200, body: { categories } };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleCreateTicket(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const { title, description, priority, categoryId, requesterId, customerId, relatedEntity, attachments } = req.body as {
        title: string;
        description: string;
        priority?: TicketPriority;
        categoryId?: string;
        requesterId?: string;
        customerId?: string;
        relatedEntity?: { entityType: string; entityId: string };
        attachments?: Array<{ fileName: string; content: Buffer; mimeType: string }>;
      };

      const result = await this.ticketingService.createTicket(ctx, {
        title,
        description,
        priority,
        categoryId,
        requesterId: requesterId ?? customerId,
        relatedEntity,
        attachments,
      });

      return {
        status: 201,
        body: {
          ticket: result.ticket,
          initialMessage: result.message,
        },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }

  public async handleGetTicket(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const conversation = await this.ticketingService.getTicketConversation(ctx, ticketId);
      return {
        status: 200,
        body: conversation,
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 404,
        body: { error: error.message },
      };
    }
  }

  public async handleAddMessage(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const { content, visibility, attachments, idempotencyKey } = req.body as {
        content: string;
        visibility?: MessageVisibility;
        attachments?: Array<{ fileName: string; content: Buffer; mimeType: string }>;
        idempotencyKey?: string;
      };

      const message = await this.ticketingService.addMessage(ctx, ticketId, {
        content,
        visibility,
        attachments,
        idempotencyKey,
      });

      return {
        status: 201,
        body: { message },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }

  public async handleChangeStatus(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const { status } = req.body as { status: TicketStatus };
      if (!status) {
        return { status: 400, body: { error: 'Missing status' } };
      }

      const ticket = await this.ticketingService.changeTicketStatus(ctx, ticketId, status);
      return { status: 200, body: { ticket } };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleAssignTicket(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const { agentId, teamId } = req.body as { agentId?: string; teamId?: string };

      const result = await this.ticketingService.assignTicket(ctx, ticketId, { agentId, teamId });
      return {
        status: 200,
        body: result,
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }

  public async handleBulkUpdateTickets(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const { ticketIds, updates } = req.body as {
        ticketIds: string[];
        updates: BulkUpdateTicketsInput;
      };

      if (!ticketIds || !Array.isArray(ticketIds)) {
        return { status: 400, body: { error: 'Missing ticketIds array' } };
      }

      const result = await this.ticketingService.bulkUpdateTickets(ctx, ticketIds, updates ?? {});
      return { status: 200, body: result };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleListTickets(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const statusParam = req.query?.status as TicketStatus | undefined;
      const unassignedOnly = req.query?.unassignedOnly === 'true';
      const overdueOnly = req.query?.overdueOnly === 'true';
      const limit = req.query?.limit ? parseInt(req.query.limit, 10) : undefined;
      const offset = req.query?.offset ? parseInt(req.query.offset, 10) : undefined;

      const result = await this.ticketingService.listTickets(ctx, {
        status: statusParam,
        unassignedOnly,
        overdueOnly,
        limit,
        offset,
      });

      return {
        status: 200,
        body: result,
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }

  public async handleMarkTicketAsRead(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const readState = await this.ticketingService.markTicketAsRead(ctx, ticketId);
      return { status: 200, body: { readState } };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleGetUnreadCount(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const count = await this.ticketingService.getUnreadCount(ctx);
      return { status: 200, body: { unreadCount: count } };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleGetSlaMetrics(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const metrics = await this.ticketingService.getSlaMetrics(ctx);
      return { status: 200, body: metrics };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleGetOperationalReport(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const report = await this.ticketingService.getOperationalReport(ctx);
      return { status: 200, body: report };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleGetAgentWorkload(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const workload = await this.ticketingService.getAgentWorkload(ctx);
      return { status: 200, body: { workload } };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleGetAttachmentDownloadUrl(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const attachmentId = req.params?.attachmentId;
      if (!attachmentId) {
        return { status: 400, body: { error: 'Missing attachmentId' } };
      }

      const downloadUrl = await this.ticketingService.getAttachmentDownloadUrl(ctx, attachmentId);
      return { status: 200, body: { downloadUrl } };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 404, body: { error: error.message } };
    }
  }

  public async handleAnonymizeUserData(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const userId = req.params?.userId ?? req.params?.customerId;
      if (!userId) {
        return { status: 400, body: { error: 'Missing userId' } };
      }

      const result = await this.ticketingService.anonymizeUserData(ctx, userId);
      return { status: 200, body: result };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleAnonymizeCustomerData(req: HttpRequest): Promise<HttpResponse> {
    return this.handleAnonymizeUserData(req);
  }

  public async handleGetTicketEvents(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const events = await this.ticketingService.getTicketEvents(ctx, ticketId);
      return { status: 200, body: { events } };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }

  public async handleGetAssignmentHistory(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const history = await this.ticketingService.getAssignmentHistory(ctx, ticketId);
      return { status: 200, body: { history } };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return { status: error.statusCode ?? 400, body: { error: error.message } };
    }
  }
}
