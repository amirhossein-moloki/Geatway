import { randomUUID } from 'crypto';
import { TenantContext } from '../domain/context/tenant-context.js';
import { TicketCategory } from '../domain/entities/ticket-category.entity.js';
import { TicketMessage } from '../domain/entities/ticket-message.entity.js';
import { TicketAttachment } from '../domain/entities/ticket-attachment.entity.js';
import { TicketAssignment } from '../domain/entities/ticket-assignment.entity.js';
import { TicketEvent } from '../domain/entities/ticket-event.entity.js';
import { RelatedEntity, Ticket } from '../domain/entities/ticket.entity.js';
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
}

export interface TicketingServiceDependencies {
  ticketRepository: ITicketRepository;
  messageRepository: ITicketMessageRepository;
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
    }

    return this.deps.ticketRepository.findMany(ctx.tenantId, scopedFilter);
  }

  public async addMessage(
    ctx: TenantContext,
    ticketId: string,
    input: AddMessageInput,
  ): Promise<TicketMessage> {
    const ticket = await this.getTicket(ctx, ticketId);

    const requestedVisibility = input.visibility ?? MessageVisibility.PUBLIC;
    if (ctx.userRole === 'CUSTOMER' && requestedVisibility === MessageVisibility.INTERNAL) {
      throw new UnauthorizedAccessError('Customers are not permitted to create internal notes');
    }

    const messageId = this.generateId();
    const isCustomer = ctx.userRole === 'CUSTOMER';
    const authorRole = isCustomer ? MessageAuthorRole.CUSTOMER : MessageAuthorRole.AGENT;

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

    if (requestedVisibility === MessageVisibility.PUBLIC) {
      if (
        isCustomer &&
        (ticket.status === TicketStatus.WAITING_FOR_CUSTOMER || ticket.status === TicketStatus.OPEN)
      ) {
        ticket.transitionTo(TicketStatus.WAITING_FOR_AGENT);
      } else if (
        !isCustomer &&
        (ticket.status === TicketStatus.WAITING_FOR_AGENT ||
          ticket.status === TicketStatus.OPEN ||
          ticket.status === TicketStatus.IN_PROGRESS)
      ) {
        ticket.transitionTo(TicketStatus.WAITING_FOR_CUSTOMER);
      }
    }

    await this.deps.ticketRepository.update(ticket);

    const event = TicketEvent.create(
      this.generateId(),
      ticketId,
      ctx.tenantId,
      TicketingEventType.MESSAGE_ADDED,
      ctx.userId,
      ctx.userRole,
      { messageId: savedMessage.id, visibility: savedMessage.visibility },
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

    ticket.transitionTo(targetStatus);
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
