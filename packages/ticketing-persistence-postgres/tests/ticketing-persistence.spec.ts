import { describe, expect, it, beforeEach } from 'vitest';
import {
  MessageAuthorRole,
  MessageVisibility,
  Ticket,
  TicketAssignment,
  TicketAttachment,
  TicketCategory,
  TicketEvent,
  TicketMessage,
  TicketPriority,
  TicketReadState,
  TicketStatus,
  TicketingEventType,
} from '@amirhossein-moloki/ticketing-core';
import { createTestDatabase } from './test-utils.js';
import { PgExecutor } from '../src/migrator.js';
import { PostgresTicketAssignmentRepository } from '../src/repositories/postgres-ticket-assignment-repository.js';
import { PostgresTicketAttachmentRepository } from '../src/repositories/postgres-ticket-attachment-repository.js';
import { PostgresTicketCategoryRepository } from '../src/repositories/postgres-ticket-category-repository.js';
import { PostgresTicketEventRepository } from '../src/repositories/postgres-ticket-event-repository.js';
import { PostgresTicketMessageRepository } from '../src/repositories/postgres-ticket-message-repository.js';
import { PostgresTicketReadStateRepository } from '../src/repositories/postgres-ticket-read-state-repository.js';
import { PostgresTicketRepository } from '../src/repositories/postgres-ticket-repository.js';

describe('Ticketing PostgreSQL Persistence & Multi-Tenant Security', () => {
  let db: PgExecutor;
  let categoryRepo: PostgresTicketCategoryRepository;
  let ticketRepo: PostgresTicketRepository;
  let messageRepo: PostgresTicketMessageRepository;
  let attachmentRepo: PostgresTicketAttachmentRepository;
  let assignmentRepo: PostgresTicketAssignmentRepository;
  let eventRepo: PostgresTicketEventRepository;
  let readStateRepo: PostgresTicketReadStateRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    categoryRepo = new PostgresTicketCategoryRepository(db);
    ticketRepo = new PostgresTicketRepository(db);
    messageRepo = new PostgresTicketMessageRepository(db);
    attachmentRepo = new PostgresTicketAttachmentRepository(db);
    assignmentRepo = new PostgresTicketAssignmentRepository(db);
    eventRepo = new PostgresTicketEventRepository(db);
    readStateRepo = new PostgresTicketReadStateRepository(db);
  });

  it('should persist and retrieve ticket categories with tenant isolation', async () => {
    const catA = TicketCategory.create('cat-1', 'tenant-a', 'Billing', 'Billing issues');
    const catB = TicketCategory.create('cat-2', 'tenant-b', 'Technical', 'Tech issues');

    await categoryRepo.create(catA);
    await categoryRepo.create(catB);

    const categoriesA = await categoryRepo.findByTenantId('tenant-a');
    expect(categoriesA).toHaveLength(1);
    expect(categoriesA[0]?.name).toBe('Billing');

    const categoriesB = await categoryRepo.findByTenantId('tenant-b');
    expect(categoriesB).toHaveLength(1);
    expect(categoriesB[0]?.name).toBe('Technical');
  });

  it('should persist tickets, execute updates, and perform tenant-scoped queries', async () => {
    const ticketA = Ticket.create(
      'ticket-1',
      'tenant-a',
      'cust-1',
      'Refund Request',
      'I need a refund for order #100',
      TicketPriority.HIGH,
    );

    const created = await ticketRepo.create(ticketA);
    expect(created.id).toBe('ticket-1');
    expect(created.status).toBe(TicketStatus.OPEN);

    created.transitionTo(TicketStatus.IN_PROGRESS, 'AGENT');
    created.assignTo('agent-1', 'billing-team');
    await ticketRepo.update(created);

    const fetched = await ticketRepo.findById('tenant-a', 'ticket-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.status).toBe(TicketStatus.IN_PROGRESS);
    expect(fetched?.assignedAgentId).toBe('agent-1');
    expect(fetched?.assignedTeamId).toBe('billing-team');
  });

  it('should explicitly prevent cross-tenant reading or modifying of tickets', async () => {
    const ticketA = Ticket.create(
      'ticket-a',
      'tenant-a',
      'cust-1',
      'Tenant A Secret Ticket',
      'Description A',
    );
    await ticketRepo.create(ticketA);

    const crossRead = await ticketRepo.findById('tenant-b', 'ticket-a');
    expect(crossRead).toBeNull();

    const listB = await ticketRepo.findMany('tenant-b', {});
    expect(listB.items).toHaveLength(0);
    expect(listB.total).toBe(0);

    ticketA.updateMetadata({ title: 'Hacked Title' });
    const rogueTicket = new Ticket({
      ...ticketA,
      tenantId: 'tenant-b',
    });

    await expect(ticketRepo.update(rogueTicket)).rejects.toThrow();
  });

  it('should persist conversation messages and attachments with internal note isolation', async () => {
    const ticket = Ticket.create('ticket-1', 'tenant-a', 'cust-1', 'Title', 'Desc');
    await ticketRepo.create(ticket);

    const msgPublic = TicketMessage.create(
      'msg-1',
      'ticket-1',
      'tenant-a',
      'cust-1',
      MessageAuthorRole.CUSTOMER,
      'Public message',
      MessageVisibility.PUBLIC,
    );
    await messageRepo.create(msgPublic);

    const attachment = TicketAttachment.create(
      'att-1',
      'ticket-1',
      'msg-1',
      'tenant-a',
      'screenshot.png',
      'files/tenant-a/screenshot.png',
      'image/png',
      1024,
    );
    await attachmentRepo.create(attachment);

    const msgInternal = TicketMessage.create(
      'msg-2',
      'ticket-1',
      'tenant-a',
      'agent-1',
      MessageAuthorRole.AGENT,
      'Internal note: Fraud check needed',
      MessageVisibility.INTERNAL,
    );
    await messageRepo.create(msgInternal);

    const customerMsgs = await messageRepo.findByTicketId('tenant-a', 'ticket-1', false);
    expect(customerMsgs).toHaveLength(1);
    expect(customerMsgs[0]?.content).toBe('Public message');
    expect(customerMsgs[0]?.attachments).toHaveLength(1);
    expect(customerMsgs[0]?.attachments[0]?.fileName).toBe('screenshot.png');

    const agentMsgs = await messageRepo.findByTicketId('tenant-a', 'ticket-1', true);
    expect(agentMsgs).toHaveLength(2);

    const tenantBMsgs = await messageRepo.findByTicketId('tenant-b', 'ticket-1', true);
    expect(tenantBMsgs).toHaveLength(0);
  });

  it('should store and query assignment history and ticket events', async () => {
    const ticket = Ticket.create('ticket-1', 'tenant-a', 'cust-1', 'Title', 'Desc');
    await ticketRepo.create(ticket);

    const assignment = TicketAssignment.create(
      'asg-1',
      'ticket-1',
      'tenant-a',
      'admin-1',
      'agent-10',
      'support-team',
    );
    await assignmentRepo.create(assignment);

    const event = TicketEvent.create(
      'evt-1',
      'ticket-1',
      'tenant-a',
      TicketingEventType.TICKET_ASSIGNED,
      'admin-1',
      'TENANT_ADMIN',
      { assignedAgentId: 'agent-10' },
    );
    await eventRepo.create(event);

    const assignments = await assignmentRepo.findByTicketId('tenant-a', 'ticket-1');
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.assignedAgentId).toBe('agent-10');

    const events = await eventRepo.findByTicketId('tenant-a', 'ticket-1');
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe(TicketingEventType.TICKET_ASSIGNED);
  });

  it('should persist and query read states with unread count computation', async () => {
    const ticket = Ticket.create('ticket-1', 'tenant-a', 'cust-1', 'Title', 'Desc');
    await ticketRepo.create(ticket);

    const message = TicketMessage.create(
      'msg-1',
      'ticket-1',
      'tenant-a',
      'agent-1',
      MessageAuthorRole.AGENT,
      'Reply from agent',
      MessageVisibility.PUBLIC,
    );
    await messageRepo.create(message);

    const initialUnread = await readStateRepo.getUnreadCount('tenant-a', 'cust-1', true);
    expect(initialUnread).toBe(1);

    const readState = TicketReadState.create('tenant-a', 'ticket-1', 'cust-1');
    await readStateRepo.upsert(readState);

    const postReadUnread = await readStateRepo.getUnreadCount('tenant-a', 'cust-1', true);
    expect(postReadUnread).toBe(0);
  });
});
