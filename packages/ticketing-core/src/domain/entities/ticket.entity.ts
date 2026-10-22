import { TicketPriority } from '../enums/ticket-priority.enum.js';
import { TicketStatus } from '../enums/ticket-status.enum.js';
import { InvalidTicketStateError, UnauthorizedAccessError } from '../../errors/ticketing.errors.js';

export interface RelatedEntity {
  entityType: string;
  entityId: string;
}

export interface TicketProps {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  categoryId?: string;
  customerId?: string;
  requesterId?: string;
  assignedAgentId?: string;
  assignedTeamId?: string;
  relatedEntity?: RelatedEntity;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  firstResponseAt?: Date;
  lastResponseAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

export const DEFAULT_SLA_TARGET_HOURS: Record<TicketPriority, number> = {
  [TicketPriority.URGENT]: 1,
  [TicketPriority.HIGH]: 4,
  [TicketPriority.MEDIUM]: 24,
  [TicketPriority.LOW]: 48,
};

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.OPEN]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_FOR_CUSTOMER,
    TicketStatus.WAITING_FOR_AGENT,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.WAITING_FOR_CUSTOMER,
    TicketStatus.WAITING_FOR_AGENT,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.WAITING_FOR_CUSTOMER]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_FOR_AGENT,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.WAITING_FOR_AGENT]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_FOR_CUSTOMER,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.RESOLVED]: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
};

export class Ticket {
  public readonly id: string;
  public readonly tenantId: string;
  public title: string;
  public description: string;
  public status: TicketStatus;
  public priority: TicketPriority;
  public categoryId?: string;
  public customerId: string;
  public assignedAgentId?: string;
  public assignedTeamId?: string;
  public relatedEntity?: RelatedEntity;
  public metadata: Record<string, unknown>;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public firstResponseAt?: Date;
  public lastResponseAt?: Date;
  public resolvedAt?: Date;
  public closedAt?: Date;

  constructor(props: TicketProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.title = props.title;
    this.description = props.description;
    this.status = props.status;
    this.priority = props.priority;
    this.categoryId = props.categoryId;
    this.customerId = props.requesterId ?? props.customerId ?? '';
    this.assignedAgentId = props.assignedAgentId;
    this.assignedTeamId = props.assignedTeamId;
    this.relatedEntity = props.relatedEntity;
    this.metadata = props.metadata ?? {};
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.firstResponseAt = props.firstResponseAt;
    this.lastResponseAt = props.lastResponseAt;
    this.resolvedAt = props.resolvedAt;
    this.closedAt = props.closedAt;
  }

  public get requesterId(): string {
    return this.customerId;
  }

  public set requesterId(val: string) {
    this.customerId = val;
  }

  public static create(
    id: string,
    tenantId: string,
    requesterIdOrCustomerId: string,
    title: string,
    description: string,
    priority: TicketPriority = TicketPriority.MEDIUM,
    categoryId?: string,
    relatedEntity?: RelatedEntity,
    metadata?: Record<string, unknown>,
  ): Ticket {
    const now = new Date();
    return new Ticket({
      id,
      tenantId,
      requesterId: requesterIdOrCustomerId,
      title,
      description,
      status: TicketStatus.OPEN,
      priority,
      categoryId,
      relatedEntity,
      metadata: metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });
  }

  public transitionTo(targetStatus: TicketStatus, actorRole?: string): void {
    if (this.status === targetStatus) {
      return;
    }

    if (actorRole === 'CUSTOMER' || actorRole === 'REQUESTER') {
      const allowedCustomerStatuses = [
        TicketStatus.CLOSED,
        TicketStatus.OPEN,
        TicketStatus.WAITING_FOR_AGENT,
      ];
      if (!allowedCustomerStatuses.includes(targetStatus)) {
        throw new UnauthorizedAccessError(
          `Requesters are not permitted to transition ticket to '${targetStatus}'`,
        );
      }
    }

    const allowed = ALLOWED_TRANSITIONS[this.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new InvalidTicketStateError(this.status, targetStatus, { ticketId: this.id });
    }

    this.status = targetStatus;
    this.updatedAt = new Date();

    if (targetStatus === TicketStatus.RESOLVED && !this.resolvedAt) {
      this.resolvedAt = this.updatedAt;
    } else if (targetStatus === TicketStatus.CLOSED && !this.closedAt) {
      this.closedAt = this.updatedAt;
    } else if (targetStatus === TicketStatus.OPEN || targetStatus === TicketStatus.IN_PROGRESS) {
      // Reopening ticket
      this.resolvedAt = undefined;
      this.closedAt = undefined;
    }
  }

  public recordResponse(isAgentResponse: boolean): void {
    const now = new Date();
    this.lastResponseAt = now;
    if (isAgentResponse && !this.firstResponseAt) {
      this.firstResponseAt = now;
    }
    this.updatedAt = now;
  }

  public updateMetadata(props: {
    title?: string;
    description?: string;
    priority?: TicketPriority;
    categoryId?: string;
    metadata?: Record<string, unknown>;
  }): void {
    if (props.title !== undefined) this.title = props.title;
    if (props.description !== undefined) this.description = props.description;
    if (props.priority !== undefined) this.priority = props.priority;
    if (props.categoryId !== undefined) this.categoryId = props.categoryId;
    if (props.metadata !== undefined) {
      this.metadata = { ...this.metadata, ...props.metadata };
    }
    this.updatedAt = new Date();
  }

  public assignTo(agentId?: string, teamId?: string): void {
    this.assignedAgentId = agentId;
    this.assignedTeamId = teamId;
    this.updatedAt = new Date();
  }

  public getSlaDeadline(customSlaHours?: number): Date {
    const targetHours = customSlaHours ?? DEFAULT_SLA_TARGET_HOURS[this.priority] ?? 24;
    return new Date(this.createdAt.getTime() + targetHours * 60 * 60 * 1000);
  }

  public isOverdue(customSlaHours?: number, now = new Date()): boolean {
    if (this.status === TicketStatus.RESOLVED || this.status === TicketStatus.CLOSED) {
      return false;
    }
    if (this.firstResponseAt) {
      return false;
    }
    return now.getTime() > this.getSlaDeadline(customSlaHours).getTime();
  }
}
