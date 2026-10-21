import { describe, expect, it, beforeEach } from 'vitest';
import { TicketCategory } from '../src/domain/entities/ticket-category.entity.js';
import { TicketMessage } from '../src/domain/entities/ticket-message.entity.js';
import { TicketAssignment } from '../src/domain/entities/ticket-assignment.entity.js';
import { TicketEvent } from '../src/domain/entities/ticket-event.entity.js';
import { Ticket } from '../src/domain/entities/ticket.entity.js';
import { TicketReadState } from '../src/domain/entities/ticket-read-state.entity.js';
import { MessageVisibility } from '../src/domain/enums/message-visibility.enum.js';
import { TicketPriority } from '../src/domain/enums/ticket-priority.enum.js';
import { TicketStatus } from '../src/domain/enums/ticket-status.enum.js';
import { TenantContext } from '../src/domain/context/tenant-context.js';
import { TicketNotFoundError, TicketingError, UnauthorizedAccessError } from '../src/errors/ticketing.errors.js';
import { ITicketAssignmentRepository } from '../src/ports/ticket-assignment-repository.port.js';
import { ITicketCategoryRepository } from '../src/ports/ticket-category-repository.port.js';
import { ITicketEventRepository } from '../src/ports/ticket-event-repository.port.js';
import { ITicketMessageRepository } from '../src/ports/ticket-message-repository.port.js';
import { ITicketReadStateRepository } from '../src/ports/ticket-read-state-repository.port.js';
import { ITicketRepository, TicketFilterOptions } from '../src/ports/ticket-repository.port.js';
import { TicketingService } from '../src/services/ticketing.service.js';

class InMemoryTicketRepository implements ITicketRepository {
  private tickets = new Map<string, Ticket>();

  async create(ticket: Ticket): Promise<Ticket> {
    const key = `${ticket.tenantId}:${ticket.id}`;
    this.tickets.set(key, ticket);
    return ticket;
  }

  async findById(tenantId: string, id: string): Promise<Ticket | null> {
    const ticket = this.tickets.get(`${tenantId}:${id}`);
    return ticket ?? null;
  }

  async update(ticket: Ticket): Promise<Ticket> {
    const key = `${ticket.tenantId}:${ticket.id}`;
    this.tickets.set(key, ticket);
    return ticket;
  }

  async findMany(
    tenantId: string,
    filter: TicketFilterOptions,
  ): Promise<{ items: Ticket[]; total: number }> {
    let items = Array.from(this.tickets.values()).filter((t) => t.tenantId === tenantId);
    if (filter.customerId) {
      items = items.filter((t) => t.customerId === filter.customerId);
    }
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      items = items.filter((t) => statuses.includes(t.status));
    }
    if (filter.unassignedOnly) {
      items = items.filter((t) => !t.assignedAgentId && !t.assignedTeamId);
    }
    return { items, total: items.length };
  }
}

class InMemoryMessageRepository implements ITicketMessageRepository {
  private messages: TicketMessage[] = [];

  async create(message: TicketMessage): Promise<TicketMessage> {
    this.messages.push(message);
    return message;
  }

  async findByTicketId(
    tenantId: string,
    ticketId: string,
    includeInternal: boolean,
  ): Promise<TicketMessage[]> {
    return this.messages.filter(
      (m) =>
        m.tenantId === tenantId &&
        m.ticketId === ticketId &&
        (includeInternal || m.visibility === MessageVisibility.PUBLIC),
    );
  }

  async findById(tenantId: string, id: string): Promise<TicketMessage | null> {
    return this.messages.find((m) => m.tenantId === tenantId && m.id === id) ?? null;
  }
}

class InMemoryCategoryRepository implements ITicketCategoryRepository {
  private categories: TicketCategory[] = [];

  async create(category: TicketCategory): Promise<TicketCategory> {
    this.categories.push(category);
    return category;
  }

  async findByTenantId(tenantId: string, activeOnly?: boolean): Promise<TicketCategory[]> {
    return this.categories.filter((c) => c.tenantId === tenantId && (!activeOnly || c.isActive));
  }

  async findById(tenantId: string, id: string): Promise<TicketCategory | null> {
    return this.categories.find((c) => c.tenantId === tenantId && c.id === id) ?? null;
  }

  async update(category: TicketCategory): Promise<TicketCategory> {
    const idx = this.categories.findIndex(
      (c) => c.tenantId === category.tenantId && c.id === category.id,
    );
    if (idx !== -1) this.categories[idx] = category;
    return category;
  }
}

class InMemoryAssignmentRepository implements ITicketAssignmentRepository {
  private assignments: TicketAssignment[] = [];

  async create(assignment: TicketAssignment): Promise<TicketAssignment> {
    this.assignments.push(assignment);
    return assignment;
  }

  async findByTicketId(tenantId: string, ticketId: string): Promise<TicketAssignment[]> {
    return this.assignments.filter((a) => a.tenantId === tenantId && a.ticketId === ticketId);
  }
}

class InMemoryEventRepository implements ITicketEventRepository {
  private events: TicketEvent[] = [];

  async create(event: TicketEvent): Promise<TicketEvent> {
    this.events.push(event);
    return event;
  }

  async findByTicketId(tenantId: string, ticketId: string): Promise<TicketEvent[]> {
    return this.events.filter((e) => e.tenantId === tenantId && e.ticketId === ticketId);
  }
}

class InMemoryReadStateRepository implements ITicketReadStateRepository {
  private states = new Map<string, TicketReadState>();

  async upsert(readState: TicketReadState): Promise<TicketReadState> {
    const key = `${readState.tenantId}:${readState.ticketId}:${readState.userId}`;
    this.states.set(key, readState);
    return readState;
  }

  async findByUserAndTicket(tenantId: string, userId: string, ticketId: string): Promise<TicketReadState | null> {
    return this.states.get(`${tenantId}:${ticketId}:${userId}`) ?? null;
  }

  async getUnreadCount(_tenantId: string, _userId: string, _isCustomer: boolean): Promise<number> {
    return 1;
  }
}

describe('TicketingService', () => {
  let service: TicketingService;
  let ticketRepo: InMemoryTicketRepository;
  let messageRepo: InMemoryMessageRepository;
  let categoryRepo: InMemoryCategoryRepository;
  let assignmentRepo: InMemoryAssignmentRepository;
  let eventRepo: InMemoryEventRepository;
  let readStateRepo: InMemoryReadStateRepository;

  const tenantAdminCtx: TenantContext = {
    tenantId: 'tenant-a',
    userId: 'admin-1',
    userRole: 'TENANT_ADMIN',
  };

  const agentCtx: TenantContext = {
    tenantId: 'tenant-a',
    userId: 'agent-1',
    userRole: 'AGENT',
  };

  const customer1Ctx: TenantContext = {
    tenantId: 'tenant-a',
    userId: 'cust-1',
    userRole: 'CUSTOMER',
  };

  const customer2Ctx: TenantContext = {
    tenantId: 'tenant-a',
    userId: 'cust-2',
    userRole: 'CUSTOMER',
  };

  const tenantBCustomerCtx: TenantContext = {
    tenantId: 'tenant-b',
    userId: 'cust-1',
    userRole: 'CUSTOMER',
  };

  beforeEach(() => {
    ticketRepo = new InMemoryTicketRepository();
    messageRepo = new InMemoryMessageRepository();
    categoryRepo = new InMemoryCategoryRepository();
    assignmentRepo = new InMemoryAssignmentRepository();
    eventRepo = new InMemoryEventRepository();
    readStateRepo = new InMemoryReadStateRepository();

    service = new TicketingService({
      ticketRepository: ticketRepo,
      messageRepository: messageRepo,
      categoryRepository: categoryRepo,
      attachmentRepository: assignmentRepo,
      assignmentRepository: assignmentRepo,
      eventRepository: eventRepo,
      readStateRepository: readStateRepo,
    });
  });

  it('should create and update categories', async () => {
    const category = await service.createCategory(tenantAdminCtx, {
      name: 'Billing',
      description: 'Billing issues',
    });

    expect(category.name).toBe('Billing');

    const updated = await service.updateCategory(tenantAdminCtx, category.id, {
      name: 'Billing & Invoicing',
      isActive: false,
    });

    expect(updated.name).toBe('Billing & Invoicing');
    expect(updated.isActive).toBe(false);
  });

  it('should validate non-empty message content and support message idempotency', async () => {
    const { ticket } = await service.createTicket(customer1Ctx, {
      title: 'Validation test',
      description: 'Testing message input',
    });

    await expect(
      service.addMessage(customer1Ctx, ticket.id, { content: '  ' }),
    ).rejects.toThrow(TicketingError);

    const msg1 = await service.addMessage(customer1Ctx, ticket.id, {
      content: 'Hello team',
      idempotencyKey: 'key-123',
    });

    const msg2 = await service.addMessage(customer1Ctx, ticket.id, {
      content: 'Hello team',
      idempotencyKey: 'key-123',
    });

    expect(msg1.id).toBe(msg2.id);
  });

  it('should automatically reopen resolved/closed tickets when customer replies', async () => {
    const { ticket } = await service.createTicket(customer1Ctx, {
      title: 'Reopen test',
      description: 'Initial text',
    });

    await service.changeTicketStatus(agentCtx, ticket.id, TicketStatus.RESOLVED);

    await service.addMessage(customer1Ctx, ticket.id, {
      content: 'The issue is actually still occurring!',
    });

    const updated = await service.getTicket(customer1Ctx, ticket.id);
    expect(updated.status).toBe(TicketStatus.OPEN);
  });

  it('should mark tickets as read and retrieve unread count', async () => {
    const { ticket } = await service.createTicket(customer1Ctx, {
      title: 'Read test',
      description: 'Test text',
    });

    const readState = await service.markTicketAsRead(customer1Ctx, ticket.id);
    expect(readState.ticketId).toBe(ticket.id);

    const count = await service.getUnreadCount(customer1Ctx);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should perform bulk updates safely', async () => {
    const { ticket: t1 } = await service.createTicket(customer1Ctx, { title: 'T1', description: 'D1' });
    const { ticket: t2 } = await service.createTicket(customer1Ctx, { title: 'T2', description: 'D2' });

    const bulkRes = await service.bulkUpdateTickets(agentCtx, [t1.id, t2.id, 'non-existent-id'], {
      status: TicketStatus.IN_PROGRESS,
      assignedAgentId: 'agent-1',
    });

    expect(bulkRes.results).toHaveLength(3);
    expect(bulkRes.results[0]?.success).toBe(true);
    expect(bulkRes.results[1]?.success).toBe(true);
    expect(bulkRes.results[2]?.success).toBe(false);
  });

  it('should generate SLA metrics, operational reports, and agent workload', async () => {
    await service.createTicket(customer1Ctx, { title: 'T1', description: 'D1', priority: TicketPriority.URGENT });
    await service.createTicket(customer1Ctx, { title: 'T2', description: 'D2', priority: TicketPriority.LOW });

    const metrics = await service.getSlaMetrics(tenantAdminCtx);
    expect(metrics.totalTickets).toBe(2);

    const report = await service.getOperationalReport(tenantAdminCtx);
    expect(report.byPriority[TicketPriority.URGENT]).toBe(1);
    expect(report.unassignedCount).toBe(2);

    const workload = await service.getAgentWorkload(tenantAdminCtx);
    expect(workload).toBeDefined();
  });

  it('should anonymize customer data upon admin request', async () => {
    const { ticket } = await service.createTicket(customer1Ctx, {
      title: 'Anonymization test',
      description: 'Contains customer info',
    });

    const result = await service.anonymizeCustomerData(tenantAdminCtx, 'cust-1');
    expect(result.anonymizedTicketCount).toBe(1);

    const updated = await service.getTicket(tenantAdminCtx, ticket.id);
    expect(updated.title).toBe('[Anonymized Ticket]');
    expect(updated.customerId).toContain('anonymized-');
  });
});
