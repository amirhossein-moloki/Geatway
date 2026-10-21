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
import {
  InvalidTenancyConfigError,
  TenantMismatchError,
  TicketNotFoundError,
  UnauthorizedAccessError,
} from '../src/errors/ticketing.errors.js';
import { ITicketAssignmentRepository } from '../src/ports/ticket-assignment-repository.port.js';
import { ITicketCategoryRepository } from '../src/ports/ticket-category-repository.port.js';
import { ITicketEventRepository } from '../src/ports/ticket-event-repository.port.js';
import { ITicketMessageRepository } from '../src/ports/ticket-message-repository.port.js';
import { ITicketReadStateRepository } from '../src/ports/ticket-read-state-repository.port.js';
import { ITicketRepository, TicketFilterOptions } from '../src/ports/ticket-repository.port.js';
import { ITicketingEventEmitter } from '../src/ports/ticketing-event-emitter.port.js';
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
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      items = items.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
      );
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

class InMemoryEventRepository implements ITicketEventRepository {
  public events: TicketEvent[] = [];

  async create(event: TicketEvent): Promise<TicketEvent> {
    this.events.push(event);
    return event;
  }

  async findByTicketId(tenantId: string, ticketId: string): Promise<TicketEvent[]> {
    return this.events.filter((e) => e.tenantId === tenantId && e.ticketId === ticketId);
  }
}

class MockEventEmitter implements ITicketingEventEmitter {
  public emittedEvents: TicketEvent[] = [];

  async emit(event: TicketEvent): Promise<void> {
    this.emittedEvents.push(event);
  }
}

describe('Tenancy Mode Configuration and Behaviors', () => {
  describe('Configuration Validation', () => {
    it('should throw InvalidTenancyConfigError when initialized with invalid mode', () => {
      expect(
        () =>
          new TicketingService({
            ticketRepository: new InMemoryTicketRepository(),
            messageRepository: new InMemoryMessageRepository(),
            tenancyConfig: { mode: 'INVALID_MODE' as any },
          }),
      ).toThrow(InvalidTenancyConfigError);
    });

    it('should default to MULTI_TENANT mode when tenancyConfig is omitted', () => {
      const service = new TicketingService({
        ticketRepository: new InMemoryTicketRepository(),
        messageRepository: new InMemoryMessageRepository(),
      });
      expect(service.tenancyConfig.mode).toBe('MULTI_TENANT');
      expect(service.tenancyConfig.defaultTenantId).toBe('default');
    });

    it('should allow custom defaultTenantId in SINGLE_TENANT mode', () => {
      const service = new TicketingService({
        ticketRepository: new InMemoryTicketRepository(),
        messageRepository: new InMemoryMessageRepository(),
        tenancyConfig: { mode: 'SINGLE_TENANT', defaultTenantId: 'store_001' },
      });
      expect(service.tenancyConfig.mode).toBe('SINGLE_TENANT');
      expect(service.tenancyConfig.defaultTenantId).toBe('store_001');
    });
  });

  describe('Single-Tenant Mode', () => {
    let service: TicketingService;
    let ticketRepo: InMemoryTicketRepository;
    let messageRepo: InMemoryMessageRepository;
    let categoryRepo: InMemoryCategoryRepository;
    let eventRepo: InMemoryEventRepository;
    let eventEmitter: MockEventEmitter;

    beforeEach(() => {
      ticketRepo = new InMemoryTicketRepository();
      messageRepo = new InMemoryMessageRepository();
      categoryRepo = new InMemoryCategoryRepository();
      eventRepo = new InMemoryEventRepository();
      eventEmitter = new MockEventEmitter();

      service = new TicketingService({
        ticketRepository: ticketRepo,
        messageRepository: messageRepo,
        categoryRepository: categoryRepo,
        eventRepository: eventRepo,
        eventEmitter,
        tenancyConfig: { mode: 'SINGLE_TENANT', defaultTenantId: 'my_store' },
      });
    });

    it('should operate without tenantId in TenantContext', async () => {
      const customerCtx: TenantContext = {
        userId: 'cust-single-1',
        userRole: 'CUSTOMER',
      };

      const { ticket, message } = await service.createTicket(customerCtx, {
        title: 'Single-Tenant Ticket',
        description: 'No explicit tenant ID provided',
      });

      expect(ticket.tenantId).toBe('my_store');
      expect(message.tenantId).toBe('my_store');

      const retrieved = await service.getTicket(customerCtx, ticket.id);
      expect(retrieved.id).toBe(ticket.id);
      expect(retrieved.tenantId).toBe('my_store');

      const listRes = await service.listTickets(customerCtx);
      expect(listRes.items).toHaveLength(1);
      expect(listRes.items[0]?.tenantId).toBe('my_store');
    });

    it('should enforce normal user and role authorization in Single-Tenant Mode', async () => {
      const customer1Ctx: TenantContext = { userId: 'cust-1', userRole: 'CUSTOMER' };
      const customer2Ctx: TenantContext = { userId: 'cust-2', userRole: 'CUSTOMER' };
      const agentCtx: TenantContext = { userId: 'agent-1', userRole: 'AGENT' };

      const { ticket } = await service.createTicket(customer1Ctx, {
        title: 'Customer 1 Ticket',
        description: 'Confidential problem',
      });

      // Customer 2 must NOT be able to access Customer 1's ticket even in Single-Tenant mode
      await expect(service.getTicket(customer2Ctx, ticket.id)).rejects.toThrow(TicketNotFoundError);

      // Customer 1 cannot create category
      await expect(service.createCategory(customer1Ctx, { name: 'Support' })).rejects.toThrow(
        UnauthorizedAccessError,
      );

      // Customer 1 cannot add internal notes
      await expect(
        service.addMessage(customer1Ctx, ticket.id, {
          content: 'Internal note',
          visibility: MessageVisibility.INTERNAL,
        }),
      ).rejects.toThrow(UnauthorizedAccessError);

      // Agent can view Customer 1's ticket
      const agentGet = await service.getTicket(agentCtx, ticket.id);
      expect(agentGet.id).toBe(ticket.id);
    });

    it('should propagate resolved single tenant ID through events and emitters', async () => {
      const customerCtx: TenantContext = { userId: 'cust-1', userRole: 'CUSTOMER' };

      const { ticket } = await service.createTicket(customerCtx, {
        title: 'Event check',
        description: 'Checking event tenantId',
      });

      expect(eventEmitter.emittedEvents).toHaveLength(1);
      expect(eventEmitter.emittedEvents[0]?.tenantId).toBe('my_store');

      const events = await service.getTicketEvents(customerCtx, ticket.id);
      expect(events[0]?.tenantId).toBe('my_store');
    });
  });

  describe('Multi-Tenant Mode', () => {
    let service: TicketingService;
    let ticketRepo: InMemoryTicketRepository;
    let messageRepo: InMemoryMessageRepository;
    let categoryRepo: InMemoryCategoryRepository;
    let eventRepo: InMemoryEventRepository;

    beforeEach(() => {
      ticketRepo = new InMemoryTicketRepository();
      messageRepo = new InMemoryMessageRepository();
      categoryRepo = new InMemoryCategoryRepository();
      eventRepo = new InMemoryEventRepository();

      service = new TicketingService({
        ticketRepository: ticketRepo,
        messageRepository: messageRepo,
        categoryRepository: categoryRepo,
        eventRepository: eventRepo,
        tenancyConfig: { mode: 'MULTI_TENANT' },
      });
    });

    it('should reject requests missing tenantId in TenantContext', async () => {
      const missingTenantCtx: TenantContext = {
        userId: 'user-1',
        userRole: 'CUSTOMER',
      };

      await expect(
        service.createTicket(missingTenantCtx, {
          title: 'Fail Ticket',
          description: 'No tenantId',
        }),
      ).rejects.toThrow('tenant mismatch');

      await expect(service.listCategories(missingTenantCtx)).rejects.toThrow('tenant mismatch');

      await expect(service.getUnreadCount(missingTenantCtx)).rejects.toThrow('tenant mismatch');
    });

    it('should strictly isolate data between tenants and prevent cross-tenant access', async () => {
      const tenantACustomerCtx: TenantContext = {
        tenantId: 'tenant-a',
        userId: 'cust-1',
        userRole: 'CUSTOMER',
      };

      const tenantBCustomerCtx: TenantContext = {
        tenantId: 'tenant-b',
        userId: 'cust-1', // Same user ID, different tenant
        userRole: 'CUSTOMER',
      };

      const tenantBAgentCtx: TenantContext = {
        tenantId: 'tenant-b',
        userId: 'agent-b',
        userRole: 'AGENT',
      };

      // Create ticket in Tenant A
      const { ticket: ticketA } = await service.createTicket(tenantACustomerCtx, {
        title: 'Tenant A Ticket',
        description: 'Secret data',
      });

      // Tenant B customer cannot access Tenant A's ticket
      await expect(service.getTicket(tenantBCustomerCtx, ticketA.id)).rejects.toThrow(
        TicketNotFoundError,
      );

      // Tenant B agent cannot access Tenant A's ticket
      await expect(service.getTicket(tenantBAgentCtx, ticketA.id)).rejects.toThrow(
        TicketNotFoundError,
      );

      // Tenant B listTickets returns no tickets from Tenant A
      const tenantBList = await service.listTickets(tenantBAgentCtx, { searchQuery: 'Secret' });
      expect(tenantBList.items).toHaveLength(0);

      // Tenant B adding message to Tenant A ticket is rejected
      await expect(
        service.addMessage(tenantBAgentCtx, ticketA.id, { content: 'Hack attempt' }),
      ).rejects.toThrow(TicketNotFoundError);
    });
  });
});
