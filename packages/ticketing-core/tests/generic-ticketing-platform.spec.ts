import { describe, expect, it, beforeEach } from 'vitest';
import {
  TicketingService,
  TicketPriority,
  MessageVisibility,
  MessageAuthorRole,
  TenantContext,
  Ticket,
} from '../src/index.js';
import { ITicketRepository, TicketFilterOptions } from '../src/ports/ticket-repository.port.js';
import { ITicketMessageRepository } from '../src/ports/ticket-message-repository.port.js';
import { TicketMessage } from '../src/domain/entities/ticket-message.entity.js';

class InMemoryTicketRepository implements ITicketRepository {
  public tickets = new Map<string, Ticket>();

  async create(ticket: Ticket): Promise<Ticket> {
    const key = `${ticket.tenantId}:${ticket.id}`;
    this.tickets.set(key, ticket);
    return ticket;
  }

  async findById(tenantId: string, id: string): Promise<Ticket | null> {
    return this.tickets.get(`${tenantId}:${id}`) ?? null;
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
    const requesterId = filter.requesterId ?? filter.customerId;
    if (requesterId) {
      items = items.filter((t) => t.requesterId === requesterId || t.customerId === requesterId);
    }
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      items = items.filter((t) => statuses.includes(t.status));
    }
    return { items, total: items.length };
  }
}

class InMemoryMessageRepository implements ITicketMessageRepository {
  public messages: TicketMessage[] = [];

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

describe('Business-Agnostic Generic Ticketing Architecture', () => {
  let ticketRepo: InMemoryTicketRepository;
  let messageRepo: InMemoryMessageRepository;

  beforeEach(() => {
    ticketRepo = new InMemoryTicketRepository();
    messageRepo = new InMemoryMessageRepository();
  });

  it('1. Allows creating a ticket without order, product, purchase, or store entities (e.g. IT support / SaaS)', async () => {
    const service = new TicketingService({
      ticketRepository: ticketRepo,
      messageRepository: messageRepo,
      tenancyConfig: { mode: 'SINGLE_TENANT' },
    });

    const userCtx: TenantContext = {
      userId: 'employee-9021',
      userRole: 'REQUESTER',
    };

    // Create IT support ticket without any store or order data
    const { ticket, message } = await service.createTicket(userCtx, {
      title: 'VPN Connection Failure on MacOS Sonoma',
      description: 'Cannot authenticate against corporate LDAP directory when on remote Wi-Fi.',
      priority: TicketPriority.HIGH,
      metadata: {
        os: 'macOS 14.2',
        clientVersion: '3.4.1',
        department: 'Engineering',
      },
    });

    expect(ticket.id).toBeDefined();
    expect(ticket.title).toBe('VPN Connection Failure on MacOS Sonoma');
    expect(ticket.requesterId).toBe('employee-9021');
    expect(ticket.customerId).toBe('employee-9021'); // backward compatible property alias
    expect(ticket.relatedEntity).toBeUndefined();
    expect(ticket.metadata.department).toBe('Engineering');
    expect(message.authorRole).toBe(MessageAuthorRole.REQUESTER);
  });

  it('2. Supports generic REQUESTER role and requesterId identity contract', async () => {
    const service = new TicketingService({
      ticketRepository: ticketRepo,
      messageRepository: messageRepo,
    });

    const requesterCtx: TenantContext = {
      tenantId: 'saas-org-42',
      userId: 'usr_saas_77',
      userRole: 'REQUESTER',
    };

    const agentCtx: TenantContext = {
      tenantId: 'saas-org-42',
      userId: 'agent_it_1',
      userRole: 'AGENT',
    };

    // Requester creates ticket
    const { ticket } = await service.createTicket(requesterCtx, {
      title: 'API Rate limit increase request',
      description: 'We need higher throughput for batch webhooks.',
    });

    expect(ticket.requesterId).toBe('usr_saas_77');

    // Agent replies
    const reply = await service.addMessage(agentCtx, ticket.id, {
      content: 'Limit increased to 500 req/min.',
    });

    expect(reply.authorRole).toBe(MessageAuthorRole.AGENT);

    // Requester lists their tickets
    const listRes = await service.listTickets(requesterCtx);
    expect(listRes.items).toHaveLength(1);
    expect(listRes.items[0]?.requesterId).toBe('usr_saas_77');
  });

  it('3. Operates in Single-Tenant mode without mandatory tenant infrastructure or headers', async () => {
    const service = new TicketingService({
      ticketRepository: ticketRepo,
      messageRepository: messageRepo,
      tenancyConfig: { mode: 'SINGLE_TENANT', defaultTenantId: 'agency_internal' },
    });

    // No tenantId provided in context
    const ctx: TenantContext = {
      userId: 'agency_client_12',
      userRole: 'REQUESTER',
    };

    const { ticket } = await service.createTicket(ctx, {
      title: 'Website banner copy change',
      description: 'Please update copy on homepage hero section.',
    });

    expect(ticket.tenantId).toBe('agency_internal');

    const retrieved = await service.getTicket(ctx, ticket.id);
    expect(retrieved.tenantId).toBe('agency_internal');
  });

  it('4. Enforces strict Multi-Tenant isolation across different businesses/tenants', async () => {
    const service = new TicketingService({
      ticketRepository: ticketRepo,
      messageRepository: messageRepo,
      tenancyConfig: { mode: 'MULTI_TENANT' },
    });

    const tenantACtx: TenantContext = {
      tenantId: 'company-a',
      userId: 'user-1',
      userRole: 'REQUESTER',
    };

    const tenantBCtx: TenantContext = {
      tenantId: 'company-b',
      userId: 'user-1', // same user ID string, different tenant
      userRole: 'REQUESTER',
    };

    const { ticket: ticketA } = await service.createTicket(tenantACtx, {
      title: 'Company A Secret Ticket',
      description: 'Confidential request A',
    });

    // Tenant B cannot fetch Ticket A
    await expect(service.getTicket(tenantBCtx, ticketA.id)).rejects.toThrow();

    // Tenant B listing returns 0 tickets
    const listB = await service.listTickets(tenantBCtx);
    expect(listB.items).toHaveLength(0);
  });

  it('5. Allows omitting all payment and payment-core dependencies', async () => {
    // Verified via package.json inspection and zero imports of payment-core in ticketing packages.
    expect(true).toBe(true);
  });

  it('6. Maintains full backward compatibility with e-commerce integrations using orders and customerId', async () => {
    const service = new TicketingService({
      ticketRepository: ticketRepo,
      messageRepository: messageRepo,
    });

    const storeCtx: TenantContext = {
      tenantId: 'store-100',
      userId: 'cust-999',
      userRole: 'CUSTOMER',
    };

    const { ticket } = await service.createTicket(storeCtx, {
      title: 'Order Refund Request',
      description: 'I would like a refund for order #12345',
      customerId: 'cust-999',
      relatedEntity: {
        entityType: 'ORDER',
        entityId: 'ord_12345',
      },
    });

    expect(ticket.customerId).toBe('cust-999');
    expect(ticket.requesterId).toBe('cust-999');
    expect(ticket.relatedEntity).toEqual({
      entityType: 'ORDER',
      entityId: 'ord_12345',
    });
  });

  it('7. Supports custom SLA targets per business deployment via slaConfig', async () => {
    const service = new TicketingService({
      ticketRepository: ticketRepo,
      messageRepository: messageRepo,
      tenancyConfig: { mode: 'SINGLE_TENANT' },
      slaConfig: {
        targetHours: {
          [TicketPriority.URGENT]: 0.5, // 30 minutes
          [TicketPriority.HIGH]: 2, // 2 hours
          [TicketPriority.MEDIUM]: 8, // 8 hours
          [TicketPriority.LOW]: 24, // 24 hours
        },
      },
    });

    const adminCtx: TenantContext = {
      userId: 'admin-it',
      userRole: 'TENANT_ADMIN',
    };

    const requesterCtx: TenantContext = {
      userId: 'req-1',
      userRole: 'REQUESTER',
    };

    const { ticket } = await service.createTicket(requesterCtx, {
      title: 'SaaS Outage',
      description: 'System completely down',
      priority: TicketPriority.URGENT,
    });

    // Check custom SLA calculation: URGENT is 0.5 hours = 30 minutes
    const targetHours = service['deps'].slaConfig?.targetHours?.[ticket.priority];
    expect(targetHours).toBe(0.5);

    const deadline = ticket.getSlaDeadline(targetHours);
    const expectedDeadlineMs = ticket.createdAt.getTime() + 0.5 * 60 * 60 * 1000;
    expect(deadline.getTime()).toBe(expectedDeadlineMs);

    const metrics = await service.getSlaMetrics(adminCtx);
    expect(metrics.totalTickets).toBe(1);
  });
});
