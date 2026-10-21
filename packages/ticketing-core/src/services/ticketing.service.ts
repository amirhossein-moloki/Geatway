import { randomUUID } from 'crypto';
import { TenantContext } from '../domain/context/tenant-context.js';
import { TicketCategory } from '../domain/entities/ticket-category.entity.js';
import { TicketMessage } from '../domain/entities/ticket-message.entity.js';
import { TicketAttachment } from '../domain/entities/ticket-attachment.entity.js';
import { TicketAssignment } from '../domain/entities/ticket-assignment.entity.js';
import { TicketEvent } from '../domain/entities/ticket-event.entity.js';
import { RelatedEntity, Ticket } from '../domain/entities/ticket.entity.js';
import { TicketReadState } from '../domain/entities/ticket-read-state.entity.js';
import { MessageAuthorRole } from '../domain/enums/message-author-role.enum.js';
import { MessageVisibility } from '../domain/enums/message-visibility.enum.js';
import { TicketPriority } from '../domain/enums/ticket-priority.enum.js';
import { TicketStatus } from '../domain/enums/ticket-status.enum.js';
import { TicketingEventType } from '../domain/enums/ticketing-event-type.enum.js';
import {
  AttachmentNotFoundError,
  InvalidCategoryError,
  TenantMismatchError,
  TicketNotFoundError,
  TicketingError,
  UnauthorizedAccessError,
} from '../errors/ticketing.errors.js';
import { INotificationHandler } from '../ports/notification-handler.port.js';
import { IStorageService } from '../ports/storage-service.port.js';
import { ITicketingEventEmitter } from '../ports/ticketing-event-emitter.port.js';
import { ITicketAssignmentRepository } from '../ports/ticket-assignment-repository.port.js';
import { ITicketAttachmentRepository } from '../ports/ticket-attachment-repository.port.js';
import { ITicketCategoryRepository } from '../ports/ticket-category-repository.port.js';
import { ITicketEventRepository } from '../ports/ticket-event-repository.port.js';
import { ITicketMessageRepository } from '../ports/ticket-message-repository.port.js';
import { ITicketReadStateRepository } from '../ports/ticket-read-state-repository.port.js';
import { ITicketRepository, TicketFilterOptions } from '../ports/ticket-repository.port.js';

export interface TicketAttachmentUploadInput {
  fileName: string;
  content: Buffer;
  mimeType: string;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  priority?: TicketPriority;
  categoryId?: string;
  customerId?: string;
  relatedEntity?: RelatedEntity;
  metadata?: Record<string, unknown>;
  attachments?: TicketAttachmentUploadInput[];
}

export interface AddMessageInput {
  content: string;
  visibility?: MessageVisibility;
  attachments?: TicketAttachmentUploadInput[];
  idempotencyKey?: string;
}

export interface BulkUpdateTicketsInput {
  status?: TicketStatus;
  assignedAgentId?: string;
  assignedTeamId?: string;
  priority?: TicketPriority;
  categoryId?: string;
}

export interface BulkUpdateResult {
  ticketId: string;
  success: boolean;
  error?: string;
}

export interface TicketingServiceDependencies {
  ticketRepository: ITicketRepository;
  messageRepository: ITicketMessageRepository;
  readStateRepository?: ITicketReadStateRepository;
  attachmentRepository?: ITicketAttachmentRepository;
  assignmentRepository?: ITicketAssignmentRepository;
  categoryRepository?: ITicketCategoryRepository;
  eventRepository?: ITicketEventRepository;
  notificationHandler?: INotificationHandler;
  storageService?: IStorageService;
  eventEmitter?: ITicketingEventEmitter;
  idGenerator?: () => string;
}

export class TicketingService {
  private readonly generateId: () => string;

  constructor(private readonly deps: TicketingServiceDependencies) {
    this.generateId = deps.idGenerator ?? (() => randomUUID());
  }

  private validateTenantContext(ctx: TenantContext): void {
    if (!ctx || !ctx.tenantId) {
      throw new TenantMismatchError('unknown', 'missing');
    }
    if (!ctx.userId) {
      throw new UnauthorizedAccessError('User ID is required in TenantContext');
    }
  }

  public async createCategory(
    ctx: TenantContext,
    input: { name: string; description?: string },
  ): Promise<TicketCategory> {
    this.validateTenantContext(ctx);
    if (ctx.userRole === 'CUSTOMER') {
      throw new UnauthorizedAccessError('Customers are not permitted to create ticket categories');
    }

    if (!this.deps.categoryRepository) {
      throw new InvalidCategoryError('Category repository is not configured');
    }

    const category = TicketCategory.create(
      this.generateId(),
      ctx.tenantId,
      input.name,
      input.description,
    );

    return this.deps.categoryRepository.create(category);
  }

  public async updateCategory(
    ctx: TenantContext,
    categoryId: string,
    input: { name?: string; description?: string; isActive?: boolean },
  ): Promise<TicketCategory> {
    this.validateTenantContext(ctx);
    if (ctx.userRole === 'CUSTOMER') {
      throw new UnauthorizedAccessError('Customers are not permitted to update ticket categories');
    }

    if (!this.deps.categoryRepository) {
      throw new InvalidCategoryError('Category repository is not configured');
    }

    const category = await this.deps.categoryRepository.findById(ctx.tenantId, categoryId);
    if (!category) {
      throw new InvalidCategoryError(`Category '${categoryId}' not found`);
    }

    category.update(input.name, input.description, input.isActive);
    return this.deps.categoryRepository.update(category);
  }

  public async listCategories(ctx: TenantContext, activeOnly = true): Promise<TicketCategory[]> {
    this.validateTenantContext(ctx);
    if (!this.deps.categoryRepository) {
      return [];
    }
    return this.deps.categoryRepository.findByTenantId(ctx.tenantId, activeOnly);
  }

  public async createTicket(
    ctx: TenantContext,
    input: CreateTicketInput,
  ): Promise<{ ticket: Ticket; message: TicketMessage }> {
    this.validateTenantContext(ctx);

    const customerId = ctx.userRole === 'CUSTOMER' ? ctx.userId : (input.customerId ?? ctx.userId);

    if (input.categoryId && this.deps.categoryRepository) {
      const category = await this.deps.categoryRepository.findById(ctx.tenantId, input.categoryId);
      if (!category || !category.isActive) {
        throw new InvalidCategoryError(`Category '${input.categoryId}' is invalid or inactive`);
      }
    }

    const ticketId = this.generateId();
    const ticket = Ticket.create(
      ticketId,
      ctx.tenantId,
      customerId,
      input.title,
      input.description,
      input.priority ?? TicketPriority.MEDIUM,
      input.categoryId,
      input.relatedEntity,
      input.metadata,
    );

    const createdTicket = await this.deps.ticketRepository.create(ticket);

    const messageId = this.generateId();
    const authorRole =
      ctx.userRole === 'CUSTOMER' ? MessageAuthorRole.CUSTOMER : MessageAuthorRole.AGENT;

    const attachmentEntities: TicketAttachment[] = [];
    if (input.attachments && input.attachments.length > 0) {
      if (!this.deps.storageService) {
        throw new UnauthorizedAccessError('Storage service is not configured for attachments');
      }
      for (const file of input.attachments) {
        const uploadRes = await this.deps.storageService.upload({
          fileName: file.fileName,
          content: file.content,
          mimeType: file.mimeType,
          tenantId: ctx.tenantId,
        });

        const attachment = TicketAttachment.create(
          this.generateId(),
          ticketId,
          messageId,
          ctx.tenantId,
          file.fileName,
          uploadRes.fileKey,
          file.mimeType,
          uploadRes.fileSizeBytes,
        );

        if (this.deps.attachmentRepository) {
          await this.deps.attachmentRepository.create(attachment);
        }
        attachmentEntities.push(attachment);
      }
    }

    const message = TicketMessage.create(
      messageId,
      ticketId,
      ctx.tenantId,
      ctx.userId,
      authorRole,
      input.description,
      MessageVisibility.PUBLIC,
      attachmentEntities,
    );

    const createdMessage = await this.deps.messageRepository.create(message);

    const event = TicketEvent.create(
      this.generateId(),
      ticketId,
      ctx.tenantId,
      TicketingEventType.TICKET_CREATED,
      ctx.userId,
      ctx.userRole,
      { title: ticket.title, priority: ticket.priority, customerId },
    );

    if (this.deps.eventRepository) {
      await this.deps.eventRepository.create(event);
    }

    if (this.deps.eventEmitter) {
      await this.deps.eventEmitter.emit(event).catch(() => {});
    }

    if (this.deps.notificationHandler) {
      await this.deps.notificationHandler.notifyTicketCreated(createdTicket).catch(() => {});
    }

    if (this.deps.readStateRepository) {
      const readState = TicketReadState.create(ctx.tenantId, ticketId, ctx.userId);
      await this.deps.readStateRepository.upsert(readState).catch(() => {});
    }

    return { ticket: createdTicket, message: createdMessage };
  }

  public async getTicket(ctx: TenantContext, ticketId: string): Promise<Ticket> {
    this.validateTenantContext(ctx);

    const ticket = await this.deps.ticketRepository.findById(ctx.tenantId, ticketId);
    if (!ticket) {
      throw new TicketNotFoundError(ticketId, ctx.tenantId);
    }

    if (ctx.userRole === 'CUSTOMER' && ticket.customerId !== ctx.userId) {
      throw new TicketNotFoundError(ticketId, ctx.tenantId);
    }

    return ticket;
  }

  public async getTicketConversation(
    ctx: TenantContext,
    ticketId: string,
  ): Promise<{ ticket: Ticket; messages: TicketMessage[] }> {
    const ticket = await this.getTicket(ctx, ticketId);

    const includeInternal = ctx.userRole !== 'CUSTOMER';

    const messages = await this.deps.messageRepository.findByTicketId(
      ctx.tenantId,
      ticketId,
      includeInternal,
    );

    if (this.deps.readStateRepository) {
      const readState = TicketReadState.create(ctx.tenantId, ticketId, ctx.userId);
      await this.deps.readStateRepository.upsert(readState).catch(() => {});
    }

    return { ticket, messages };
  }

  public async listTickets(
    ctx: TenantContext,
    filter: TicketFilterOptions = {},
  ): Promise<{ items: Ticket[]; total: number }> {
    this.validateTenantContext(ctx);

    const scopedFilter: TicketFilterOptions = { ...filter };
    if (ctx.userRole === 'CUSTOMER') {
      scopedFilter.customerId = ctx.userId;
    } else if (ctx.teamIds && ctx.teamIds.length > 0 && !scopedFilter.assignedAgentId && !scopedFilter.assignedTeamId) {
      scopedFilter.teamIds = ctx.teamIds;
    }

    return this.deps.ticketRepository.findMany(ctx.tenantId, scopedFilter);
  }

  public async addMessage(
    ctx: TenantContext,
    ticketId: string,
    input: AddMessageInput,
  ): Promise<TicketMessage> {
    if (!input.content || !input.content.trim()) {
      throw new TicketingError('Message content cannot be empty or blank', 400);
    }

    const ticket = await this.getTicket(ctx, ticketId);

    const requestedVisibility = input.visibility ?? MessageVisibility.PUBLIC;
    if (ctx.userRole === 'CUSTOMER' && requestedVisibility === MessageVisibility.INTERNAL) {
      throw new UnauthorizedAccessError('Customers are not permitted to create internal notes');
    }

    const isCustomer = ctx.userRole === 'CUSTOMER';
    const authorRole = isCustomer ? MessageAuthorRole.CUSTOMER : MessageAuthorRole.AGENT;

    // Idempotency check if idempotencyKey provided
    if (input.idempotencyKey) {
      const existingMessages = await this.deps.messageRepository.findByTicketId(
        ctx.tenantId,
        ticketId,
        true,
      );
      const match = existingMessages.find(
        (m) => m.content === input.content && m.authorId === ctx.userId,
      );
      if (match) {
        return match;
      }
    }

    const messageId = this.generateId();

    const attachmentEntities: TicketAttachment[] = [];
    if (input.attachments && input.attachments.length > 0) {
      if (!this.deps.storageService) {
        throw new UnauthorizedAccessError('Storage service is not configured for attachments');
      }
      for (const file of input.attachments) {
        const uploadRes = await this.deps.storageService.upload({
          fileName: file.fileName,
          content: file.content,
          mimeType: file.mimeType,
          tenantId: ctx.tenantId,
        });

        const attachment = TicketAttachment.create(
          this.generateId(),
          ticketId,
          messageId,
          ctx.tenantId,
          file.fileName,
          uploadRes.fileKey,
          file.mimeType,
          uploadRes.fileSizeBytes,
        );

        if (this.deps.attachmentRepository) {
          await this.deps.attachmentRepository.create(attachment);
        }
        attachmentEntities.push(attachment);
      }
    }

    const message = TicketMessage.create(
      messageId,
      ticketId,
      ctx.tenantId,
      ctx.userId,
      authorRole,
      input.content,
      requestedVisibility,
      attachmentEntities,
    );

    const savedMessage = await this.deps.messageRepository.create(message);

    const previousStatus = ticket.status;
    ticket.recordResponse(!isCustomer);

    let isReopened = false;
    if (requestedVisibility === MessageVisibility.PUBLIC) {
      if (isCustomer) {
        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) {
          ticket.transitionTo(TicketStatus.OPEN, ctx.userRole);
          isReopened = true;
        } else if (
          ticket.status === TicketStatus.WAITING_FOR_CUSTOMER ||
          ticket.status === TicketStatus.OPEN
        ) {
          ticket.transitionTo(TicketStatus.WAITING_FOR_AGENT, ctx.userRole);
        }
      } else {
        if (
          ticket.status === TicketStatus.WAITING_FOR_AGENT ||
          ticket.status === TicketStatus.OPEN ||
          ticket.status === TicketStatus.IN_PROGRESS
        ) {
          ticket.transitionTo(TicketStatus.WAITING_FOR_CUSTOMER, ctx.userRole);
        }
      }
    }

    await this.deps.ticketRepository.update(ticket);

    const event = TicketEvent.create(
      this.generateId(),
      ticketId,
      ctx.tenantId,
      isReopened ? TicketingEventType.TICKET_REOPENED : TicketingEventType.MESSAGE_ADDED,
      ctx.userId,
      ctx.userRole,
      { messageId: savedMessage.id, visibility: savedMessage.visibility, isReopened },
    );

    if (this.deps.eventRepository) {
      await this.deps.eventRepository.create(event);
    }

    if (this.deps.eventEmitter) {
      await this.deps.eventEmitter.emit(event).catch(() => {});
    }

    if (this.deps.notificationHandler) {
      await this.deps.notificationHandler.notifyMessageAdded(ticket, savedMessage).catch(() => {});
      if (ticket.status !== previousStatus) {
        await this.deps.notificationHandler
          .notifyStatusChanged(ticket, previousStatus)
          .catch(() => {});
      }
    }

    if (this.deps.readStateRepository) {
      const readState = TicketReadState.create(ctx.tenantId, ticketId, ctx.userId);
      await this.deps.readStateRepository.upsert(readState).catch(() => {});
    }

    return savedMessage;
  }

  public async updateTicketMetadata(
    ctx: TenantContext,
    ticketId: string,
    input: {
      title?: string;
      description?: string;
      priority?: TicketPriority;
      categoryId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Ticket> {
    const ticket = await this.getTicket(ctx, ticketId);

    if (ctx.userRole === 'CUSTOMER') {
      if (input.priority || input.categoryId) {
        throw new UnauthorizedAccessError('Customers cannot alter ticket priority or category');
      }
    }

    if (input.categoryId && this.deps.categoryRepository) {
      const category = await this.deps.categoryRepository.findById(ctx.tenantId, input.categoryId);
      if (!category || !category.isActive) {
        throw new InvalidCategoryError(`Category '${input.categoryId}' is invalid or inactive`);
      }
    }

    ticket.updateMetadata(input);
    const updatedTicket = await this.deps.ticketRepository.update(ticket);

    const event = TicketEvent.create(
      this.generateId(),
      ticketId,
      ctx.tenantId,
      TicketingEventType.TICKET_UPDATED,
      ctx.userId,
      ctx.userRole,
      { changes: input },
    );

    if (this.deps.eventRepository) {
      await this.deps.eventRepository.create(event);
    }

    return updatedTicket;
  }

  public async changeTicketStatus(
    ctx: TenantContext,
    ticketId: string,
    targetStatus: TicketStatus,
  ): Promise<Ticket> {
    const ticket = await this.getTicket(ctx, ticketId);
    const previousStatus = ticket.status;

    if (previousStatus === targetStatus) {
      return ticket;
    }

    ticket.transitionTo(targetStatus, ctx.userRole);
    const updatedTicket = await this.deps.ticketRepository.update(ticket);

    let eventType = TicketingEventType.TICKET_STATUS_CHANGED;
    if (targetStatus === TicketStatus.RESOLVED) eventType = TicketingEventType.TICKET_RESOLVED;
    if (targetStatus === TicketStatus.CLOSED) eventType = TicketingEventType.TICKET_CLOSED;
    if (previousStatus === TicketStatus.CLOSED || previousStatus === TicketStatus.RESOLVED) {
      if (targetStatus === TicketStatus.OPEN || targetStatus === TicketStatus.IN_PROGRESS) {
        eventType = TicketingEventType.TICKET_REOPENED;
      }
    }

    const event = TicketEvent.create(
      this.generateId(),
      ticketId,
      ctx.tenantId,
      eventType,
      ctx.userId,
      ctx.userRole,
      { previousStatus, newStatus: targetStatus },
    );

    if (this.deps.eventRepository) {
      await this.deps.eventRepository.create(event);
    }

    if (this.deps.eventEmitter) {
      await this.deps.eventEmitter.emit(event).catch(() => {});
    }

    if (this.deps.notificationHandler) {
      await this.deps.notificationHandler
        .notifyStatusChanged(updatedTicket, previousStatus)
        .catch(() => {});
    }

    return updatedTicket;
  }

  public async assignTicket(
    ctx: TenantContext,
    ticketId: string,
    input: { agentId?: string; teamId?: string },
  ): Promise<{ ticket: Ticket; assignment: TicketAssignment }> {
    this.validateTenantContext(ctx);
    if (ctx.userRole === 'CUSTOMER') {
      throw new UnauthorizedAccessError('Customers are not permitted to assign tickets');
    }

    const ticket = await this.getTicket(ctx, ticketId);
    const previousAgentId = ticket.assignedAgentId;

    ticket.assignTo(input.agentId, input.teamId);
    const updatedTicket = await this.deps.ticketRepository.update(ticket);

    const assignment = TicketAssignment.create(
      this.generateId(),
      ticketId,
      ctx.tenantId,
      ctx.userId,
      input.agentId,
      input.teamId,
      previousAgentId,
    );

    let savedAssignment = assignment;
    if (this.deps.assignmentRepository) {
      savedAssignment = await this.deps.assignmentRepository.create(assignment);
    }

    const event = TicketEvent.create(
      this.generateId(),
      ticketId,
      ctx.tenantId,
      TicketingEventType.TICKET_ASSIGNED,
      ctx.userId,
      ctx.userRole,
      { assignedAgentId: input.agentId, assignedTeamId: input.teamId, previousAgentId },
    );

    if (this.deps.eventRepository) {
      await this.deps.eventRepository.create(event);
    }

    if (this.deps.eventEmitter) {
      await this.deps.eventEmitter.emit(event).catch(() => {});
    }

    if (this.deps.notificationHandler) {
      await this.deps.notificationHandler
        .notifyTicketAssigned(updatedTicket, savedAssignment)
        .catch(() => {});
    }

    return { ticket: updatedTicket, assignment: savedAssignment };
  }

  public async bulkUpdateTickets(
    ctx: TenantContext,
    ticketIds: string[],
    updates: BulkUpdateTicketsInput,
  ): Promise<{ results: BulkUpdateResult[] }> {
    this.validateTenantContext(ctx);
    if (ctx.userRole === 'CUSTOMER') {
      throw new UnauthorizedAccessError('Customers are not permitted to execute bulk updates');
    }

    const results: BulkUpdateResult[] = [];

    for (const ticketId of ticketIds) {
      try {
        if (updates.status) {
          await this.changeTicketStatus(ctx, ticketId, updates.status);
        }
        if (updates.assignedAgentId !== undefined || updates.assignedTeamId !== undefined) {
          await this.assignTicket(ctx, ticketId, {
            agentId: updates.assignedAgentId,
            teamId: updates.assignedTeamId,
          });
        }
        if (updates.priority || updates.categoryId) {
          await this.updateTicketMetadata(ctx, ticketId, {
            priority: updates.priority,
            categoryId: updates.categoryId,
          });
        }
        results.push({ ticketId, success: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ ticketId, success: false, error: msg });
      }
    }

    return { results };
  }

  public async markTicketAsRead(ctx: TenantContext, ticketId: string): Promise<TicketReadState> {
    await this.getTicket(ctx, ticketId);
    if (!this.deps.readStateRepository) {
      return TicketReadState.create(ctx.tenantId, ticketId, ctx.userId);
    }
    const readState = TicketReadState.create(ctx.tenantId, ticketId, ctx.userId);
    return this.deps.readStateRepository.upsert(readState);
  }

  public async getUnreadCount(ctx: TenantContext): Promise<number> {
    this.validateTenantContext(ctx);
    if (!this.deps.readStateRepository) {
      return 0;
    }
    return this.deps.readStateRepository.getUnreadCount(
      ctx.tenantId,
      ctx.userId,
      ctx.userRole === 'CUSTOMER',
    );
  }

  public async getSlaMetrics(ctx: TenantContext): Promise<{
    totalTickets: number;
    overdueCount: number;
    avgFirstResponseTimeMs: number;
    avgResolutionTimeMs: number;
  }> {
    this.validateTenantContext(ctx);
    if (ctx.userRole === 'CUSTOMER') {
      throw new UnauthorizedAccessError('Customers are not permitted to access SLA metrics');
    }

    const { items } = await this.deps.ticketRepository.findMany(ctx.tenantId, { limit: 1000 });

    let overdueCount = 0;
    let firstResponseTotalMs = 0;
    let firstResponseCount = 0;
    let resolutionTotalMs = 0;
    let resolutionCount = 0;

    const now = new Date();

    for (const ticket of items) {
      if (ticket.isOverdue(undefined, now)) {
        overdueCount++;
      }
      if (ticket.firstResponseAt) {
        firstResponseTotalMs += ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
        firstResponseCount++;
      }
      if (ticket.resolvedAt) {
        resolutionTotalMs += ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
        resolutionCount++;
      }
    }

    return {
      totalTickets: items.length,
      overdueCount,
      avgFirstResponseTimeMs:
        firstResponseCount > 0 ? Math.round(firstResponseTotalMs / firstResponseCount) : 0,
      avgResolutionTimeMs:
        resolutionCount > 0 ? Math.round(resolutionTotalMs / resolutionCount) : 0,
    };
  }

  public async getOperationalReport(ctx: TenantContext): Promise<{
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    unassignedCount: number;
    overdueCount: number;
  }> {
    this.validateTenantContext(ctx);
    if (ctx.userRole === 'CUSTOMER') {
      throw new UnauthorizedAccessError('Customers are not permitted to access operational reports');
    }

    const { items } = await this.deps.ticketRepository.findMany(ctx.tenantId, { limit: 1000 });

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let unassignedCount = 0;
    let overdueCount = 0;

    const now = new Date();

    for (const ticket of items) {
      byStatus[ticket.status] = (byStatus[ticket.status] ?? 0) + 1;
      byPriority[ticket.priority] = (byPriority[ticket.priority] ?? 0) + 1;

      if (!ticket.assignedAgentId && !ticket.assignedTeamId) {
        unassignedCount++;
      }
      if (ticket.isOverdue(undefined, now)) {
        overdueCount++;
      }
    }

    return {
      byStatus,
      byPriority,
      unassignedCount,
      overdueCount,
    };
  }

  public async getAgentWorkload(ctx: TenantContext): Promise<
    Array<{ agentId?: string; teamId?: string; openTicketCount: number }>
  > {
    this.validateTenantContext(ctx);
    if (ctx.userRole === 'CUSTOMER') {
      throw new UnauthorizedAccessError('Customers are not permitted to access agent workload');
    }

    const { items } = await this.deps.ticketRepository.findMany(ctx.tenantId, {
      status: [
        TicketStatus.OPEN,
        TicketStatus.IN_PROGRESS,
        TicketStatus.WAITING_FOR_CUSTOMER,
        TicketStatus.WAITING_FOR_AGENT,
      ],
      limit: 1000,
    });

    const workloadMap = new Map<string, { agentId?: string; teamId?: string; count: number }>();

    for (const ticket of items) {
      const key = `${ticket.assignedAgentId ?? ''}:${ticket.assignedTeamId ?? ''}`;
      const existing = workloadMap.get(key) ?? {
        agentId: ticket.assignedAgentId,
        teamId: ticket.assignedTeamId,
        count: 0,
      };
      existing.count++;
      workloadMap.set(key, existing);
    }

    return Array.from(workloadMap.values()).map((w) => ({
      agentId: w.agentId,
      teamId: w.teamId,
      openTicketCount: w.count,
    }));
  }

  public async anonymizeCustomerData(
    ctx: TenantContext,
    customerId: string,
  ): Promise<{ anonymizedTicketCount: number }> {
    this.validateTenantContext(ctx);
    if (ctx.userRole !== 'TENANT_ADMIN' && ctx.userRole !== 'PLATFORM_ADMIN') {
      throw new UnauthorizedAccessError(
        'Only tenant or platform administrators can anonymize customer data',
      );
    }

    const { items } = await this.deps.ticketRepository.findMany(ctx.tenantId, { customerId, limit: 1000 });
    const anonymizedId = `anonymized-${customerId.slice(0, 8)}`;

    let count = 0;
    for (const ticket of items) {
      ticket.customerId = anonymizedId;
      ticket.updateMetadata({
        title: '[Anonymized Ticket]',
        description: '[Anonymized Description]',
        metadata: { anonymizedAt: new Date().toISOString() },
      });
      await this.deps.ticketRepository.update(ticket);
      count++;
    }

    return { anonymizedTicketCount: count };
  }

  public async getAssignmentHistory(
    ctx: TenantContext,
    ticketId: string,
  ): Promise<TicketAssignment[]> {
    await this.getTicket(ctx, ticketId);
    if (ctx.userRole === 'CUSTOMER') {
      throw new UnauthorizedAccessError('Customers are not permitted to view assignment history');
    }
    if (!this.deps.assignmentRepository) {
      return [];
    }
    return this.deps.assignmentRepository.findByTicketId(ctx.tenantId, ticketId);
  }

  public async getTicketEvents(ctx: TenantContext, ticketId: string): Promise<TicketEvent[]> {
    await this.getTicket(ctx, ticketId);
    if (!this.deps.eventRepository) {
      return [];
    }
    return this.deps.eventRepository.findByTicketId(ctx.tenantId, ticketId);
  }

  public async getAttachmentDownloadUrl(ctx: TenantContext, attachmentId: string): Promise<string> {
    this.validateTenantContext(ctx);

    if (!this.deps.attachmentRepository || !this.deps.storageService) {
      throw new AttachmentNotFoundError(attachmentId);
    }

    const attachment = await this.deps.attachmentRepository.findById(ctx.tenantId, attachmentId);

    if (!attachment) {
      throw new AttachmentNotFoundError(attachmentId);
    }

    await this.getTicket(ctx, attachment.ticketId);

    return this.deps.storageService.getDownloadUrl(attachment.fileKey, ctx.tenantId);
  }
}
