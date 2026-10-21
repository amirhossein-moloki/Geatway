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
      const { title, description, priority, categoryId, relatedEntity } = req.body as {
        title: string;
        description: string;
        priority?: TicketPriority;
        categoryId?: string;
        relatedEntity?: { entityType: string; entityId: string };
      };

      const result = await this.ticketingService.createTicket(ctx, {
        title,
        description,
        priority,
        categoryId,
        relatedEntity,
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

  public async handleListTickets(req: HttpRequest): Promise<HttpResponse> {
    try {
      const ctx = this.extractTenantContext(req);
      const statusParam = req.query?.status as TicketStatus | undefined;
      const limit = req.query?.limit ? parseInt(req.query.limit, 10) : undefined;
      const offset = req.query?.offset ? parseInt(req.query.offset, 10) : undefined;

      const result = await this.ticketingService.listTickets(ctx, {
        status: statusParam,
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
}
