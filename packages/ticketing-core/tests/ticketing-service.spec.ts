import { describe, expect, it, beforeEach } from 'vitest';
import { TicketCategory } from '../src/domain/entities/ticket-category.entity.js';
import { TicketMessage } from '../src/domain/entities/ticket-message.entity.js';
import { TicketAssignment } from '../src/domain/entities/ticket-assignment.entity.js';
import { TicketEvent } from '../src/domain/entities/ticket-event.entity.js';
import { Ticket } from '../src/domain/entities/ticket.entity.js';
import { MessageVisibility } from '../src/domain/enums/message-visibility.enum.js';
import { TicketPriority } from '../src/domain/enums/ticket-priority.enum.js';
import { TicketStatus } from '../src/domain/enums/ticket-status.enum.js';
import { TenantContext } from '../src/domain/context/tenant-context.js';
import { TicketNotFoundError, UnauthorizedAccessError } from '../src/errors/ticketing.errors.js';
import { ITicketAssignmentRepository } from '../src/ports/ticket-assignment-repository.port.js';
import { ITicketCategoryRepository } from '../src/ports/ticket-category-repository.port.js';
import { ITicketEventRepository } from '../src/ports/ticket-event-repository.port.js';
import { ITicketMessageRepository } from '../src/ports/ticket-message-repository.port.js';
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

describe('TicketingService', () => {
  let service: TicketingService;
  let ticketRepo: InMemoryTicketRepository;
  let messageRepo: InMemoryMessageRepository;
  let categoryRepo: InMemoryCategoryRepository;
  let assignmentRepo: InMemoryAssignmentRepository;
  let eventRepo: InMemoryEventRepository;

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

    service = new TicketingService({
      ticketRepository: ticketRepo,
      messageRepository: messageRepo,
      categoryRepository: categoryRepo,
      assignmentRepository: assignmentRepo,
      eventRepository: eventRepo,
    });
  });

  it('should create categories as admin and list them', async () => {
    const category = await service.createCategory(tenantAdminCtx, {
      name: 'Billing',
      description: 'Billing issues',
    });

    expect(category.name).toBe('Billing');
    expect(category.tenantId).toBe('tenant-a');

    const categories = await service.listCategories(customer1Ctx);
    expect(categories).toHaveLength(1);
    expect(categories[0]?.name).toBe('Billing');
  });

  it('should throw error if customer attempts to create category', async () => {
    await expect(service.createCategory(customer1Ctx, { name: 'Invalid' })).rejects.toThrow(
      UnauthorizedAccessError,
    );
  });

  it('should create a ticket as customer', async () => {
    const { ticket, message } = await service.createTicket(customer1Ctx, {
      title: 'Payment Failed',
      description: 'My payment was rejected during checkout',
      priority: TicketPriority.HIGH,
    });

    expect(ticket.id).toBeDefined();
    expect(ticket.customerId).toBe('cust-1');
    expect(ticket.status).toBe(TicketStatus.OPEN);
    expect(message.content).toBe('My payment was rejected during checkout');
  });

  it('should enforce customer isolation (Customer 2 cannot view Customer 1 ticket)', async () => {
    const { ticket } = await service.createTicket(customer1Ctx, {
      title: 'Cust 1 Ticket',
      description: 'Private info',
    });

    const found = await service.getTicket(customer1Ctx, ticket.id);
    expect(found.id).toBe(ticket.id);

    await expect(service.getTicket(customer2Ctx, ticket.id)).rejects.toThrow(TicketNotFoundError);
  });

  it('should enforce tenant isolation (Tenant B customer cannot view Tenant A ticket)', async () => {
    const { ticket } = await service.createTicket(customer1Ctx, {
      title: 'Tenant A Ticket',
      description: 'Sensitive data',
    });

    await expect(service.getTicket(tenantBCustomerCtx, ticket.id)).rejects.toThrow(
      TicketNotFoundError,
    );
  });

  it('should hide internal notes from customer in conversation', async () => {
    const { ticket } = await service.createTicket(customer1Ctx, {
      title: 'Issue',
      description: 'Initial customer message',
    });

    await service.addMessage(agentCtx, ticket.id, {
      content: 'Hello, we are investigating',
      visibility: MessageVisibility.PUBLIC,
    });

    await service.addMessage(agentCtx, ticket.id, {
      content: 'Internal note: Customer account flagged',
      visibility: MessageVisibility.INTERNAL,
    });

    const customerConv = await service.getTicketConversation(customer1Ctx, ticket.id);
    expect(customerConv.messages).toHaveLength(2);
    expect(customerConv.messages.some((m) => m.content.includes('Internal note'))).toBe(false);

    const agentConv = await service.getTicketConversation(agentCtx, ticket.id);
    expect(agentConv.messages).toHaveLength(3);
  });

  it('should reject customer attempting to post internal note', async () => {
    const { ticket } = await service.createTicket(customer1Ctx, {
      title: 'Issue',
      description: 'Desc',
    });

    await expect(
      service.addMessage(customer1Ctx, ticket.id, {
        content: 'Secret',
        visibility: MessageVisibility.INTERNAL,
      }),
    ).rejects.toThrow(UnauthorizedAccessError);
  });

  it('should assign ticket and track assignment history', async () => {
    const { ticket } = await service.createTicket(customer1Ctx, {
      title: 'Support request',
      description: 'Help needed',
    });

    const { assignment } = await service.assignTicket(agentCtx, ticket.id, {
      agentId: 'agent-1',
      teamId: 'tier-2-support',
    });

    expect(assignment.assignedAgentId).toBe('agent-1');
    expect(assignment.assignedTeamId).toBe('tier-2-support');

    const history = await service.getAssignmentHistory(agentCtx, ticket.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.assignedAgentId).toBe('agent-1');
  });

  it('should transition ticket status cleanly', async () => {
    const { ticket } = await service.createTicket(customer1Ctx, {
      title: 'Status Test',
      description: 'Test',
    });

    const resolved = await service.changeTicketStatus(agentCtx, ticket.id, TicketStatus.RESOLVED);
    expect(resolved.status).toBe(TicketStatus.RESOLVED);
    expect(resolved.resolvedAt).toBeInstanceOf(Date);

    const closed = await service.changeTicketStatus(agentCtx, ticket.id, TicketStatus.CLOSED);
    expect(closed.status).toBe(TicketStatus.CLOSED);

    const reopened = await service.changeTicketStatus(customer1Ctx, ticket.id, TicketStatus.OPEN);
    expect(reopened.status).toBe(TicketStatus.OPEN);
  });
});
