import {
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

    if (!tenantId) {
      throw new Error('Missing x-tenant-id header');
    }
    if (!userId) {
      throw new Error('Missing x-user-id header');
    }

    return {
      tenantId,
      userId,
      userRole,
    };
  }

  public async handleCreateTicket(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const { title, description, priority, categoryId, relatedEntity, dueAt, resolutionDueAt } =
        req.body as {
          title: string;
          description: string;
          priority?: TicketPriority;
          categoryId?: string;
          relatedEntity?: { entityType: string; entityId: string };
          dueAt?: string;
          resolutionDueAt?: string;
        };

      const result = await this.ticketingService.createTicket(ctx, {
        title,
        description,
        priority,
        categoryId,
        relatedEntity,
        dueAt: dueAt ? new Date(dueAt) : undefined,
        resolutionDueAt: resolutionDueAt ? new Date(resolutionDueAt) : undefined,
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

      const { content, visibility } = req.body as {
        content: string;
        visibility?: MessageVisibility;
      };

      const message = await this.ticketingService.addMessage(ctx, ticketId, {
        content,
        visibility,
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

      const ticket = await this.ticketingService.changeTicketStatus(ctx, ticketId, status);
      return {
        status: 200,
        body: { ticket },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }

  public async handleUpdateTicket(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const { title, description, priority, categoryId, metadata } = req.body as {
        title?: string;
        description?: string;
        priority?: TicketPriority;
        categoryId?: string;
        metadata?: Record<string, unknown>;
      };

      const ticket = await this.ticketingService.updateTicketMetadata(ctx, ticketId, {
        title,
        description,
        priority,
        categoryId,
        metadata,
      });

      return {
        status: 200,
        body: { ticket },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
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

  public async handleAutoAssignTicket(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const { candidateAgentIds } = req.body as { candidateAgentIds: string[] };

      const result = await this.ticketingService.autoAssignTicket(ctx, ticketId, candidateAgentIds);
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

  public async handleListTickets(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const statusParam = req.query?.status as TicketStatus | undefined;
      const unassignedOnly = req.query?.unassignedOnly === 'true';
      const isOverdue = req.query?.isOverdue === 'true';
      const limit = req.query?.limit ? parseInt(req.query.limit, 10) : undefined;
      const offset = req.query?.offset ? parseInt(req.query.offset, 10) : undefined;

      const result = await this.ticketingService.listTickets(ctx, {
        status: statusParam,
        unassignedOnly,
        isOverdue,
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

  public async handleCreateCategory(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const { name, description } = req.body as { name: string; description?: string };

      const category = await this.ticketingService.createCategory(ctx, { name, description });
      return {
        status: 201,
        body: { category },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
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

      return {
        status: 200,
        body: { category },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }

  public async handleListCategories(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const activeOnly = req.query?.activeOnly !== 'false';

      const categories = await this.ticketingService.listCategories(ctx, activeOnly);
      return {
        status: 200,
        body: { categories },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
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
      return {
        status: 200,
        body: { downloadUrl },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 404,
        body: { error: error.message },
      };
    }
  }

  public async handleMarkAsRead(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      await this.ticketingService.markAsRead(ctx, ticketId);
      return {
        status: 200,
        body: { success: true },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }

  public async handleGetUnreadCount(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.query?.ticketId;

      const unreadCount = await this.ticketingService.getUnreadCount(ctx, ticketId);
      return {
        status: 200,
        body: { unreadCount },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }

  public async handleBulkUpdateStatus(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const { ticketIds, status } = req.body as { ticketIds: string[]; status: TicketStatus };

      const result = await this.ticketingService.bulkUpdateStatus(ctx, ticketIds, status);
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

  public async handleBulkAssign(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const { ticketIds, agentId, teamId } = req.body as {
        ticketIds: string[];
        agentId?: string;
        teamId?: string;
      };

      const result = await this.ticketingService.bulkAssign(ctx, ticketIds, { agentId, teamId });
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

  public async handleGetAssignmentHistory(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const history = await this.ticketingService.getAssignmentHistory(ctx, ticketId);
      return {
        status: 200,
        body: { history },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }

  public async handleGetEvents(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const ticketId = req.params?.ticketId;
      if (!ticketId) {
        return { status: 400, body: { error: 'Missing ticketId' } };
      }

      const events = await this.ticketingService.getTicketEvents(ctx, ticketId);
      return {
        status: 200,
        body: { events },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }

  public async handleGetMetrics(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const startDate = req.query?.startDate ? new Date(req.query.startDate) : undefined;
      const endDate = req.query?.endDate ? new Date(req.query.endDate) : undefined;

      const metrics = await this.ticketingService.getTenantMetrics(ctx, { startDate, endDate });
      return {
        status: 200,
        body: { metrics },
      };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      return {
        status: error.statusCode ?? 400,
        body: { error: error.message },
      };
    }
  }
}
