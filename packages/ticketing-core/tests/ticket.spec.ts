import { describe, expect, it } from 'vitest';
import { Ticket } from '../src/domain/entities/ticket.entity.js';
import { TicketPriority } from '../src/domain/enums/ticket-priority.enum.js';
import { TicketStatus } from '../src/domain/enums/ticket-status.enum.js';
import {
  InvalidTicketStateError,
  UnauthorizedAccessError,
} from '../src/errors/ticketing.errors.js';

describe('Ticket Entity', () => {
  it('should create a new ticket in OPEN status', () => {
    const ticket = Ticket.create(
      'ticket-1',
      'tenant-a',
      'customer-1',
      'Order Inquiry',
      'Need help with my order',
      TicketPriority.HIGH,
    );

    expect(ticket.id).toBe('ticket-1');
    expect(ticket.tenantId).toBe('tenant-a');
    expect(ticket.customerId).toBe('customer-1');
    expect(ticket.title).toBe('Order Inquiry');
    expect(ticket.status).toBe(TicketStatus.OPEN);
    expect(ticket.priority).toBe(TicketPriority.HIGH);
    expect(ticket.createdAt).toBeInstanceOf(Date);
  });

  it('should allow valid status transitions for staff', () => {
    const ticket = Ticket.create(
      'ticket-1',
      'tenant-a',
      'customer-1',
      'Test Title',
      'Test Description',
    );

    ticket.transitionTo(TicketStatus.IN_PROGRESS, 'AGENT');
    expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);

    ticket.transitionTo(TicketStatus.WAITING_FOR_CUSTOMER, 'AGENT');
    expect(ticket.status).toBe(TicketStatus.WAITING_FOR_CUSTOMER);

    ticket.transitionTo(TicketStatus.RESOLVED, 'AGENT');
    expect(ticket.status).toBe(TicketStatus.RESOLVED);
    expect(ticket.resolvedAt).toBeInstanceOf(Date);

    ticket.transitionTo(TicketStatus.CLOSED, 'AGENT');
    expect(ticket.status).toBe(TicketStatus.CLOSED);
    expect(ticket.closedAt).toBeInstanceOf(Date);

    ticket.transitionTo(TicketStatus.OPEN, 'AGENT');
    expect(ticket.status).toBe(TicketStatus.OPEN);
    expect(ticket.resolvedAt).toBeUndefined();
    expect(ticket.closedAt).toBeUndefined();
  });

  it('should restrict customer status transitions to CLOSED or OPEN', () => {
    const ticket = Ticket.create('ticket-1', 'tenant-a', 'customer-1', 'Title', 'Desc');

    expect(() => ticket.transitionTo(TicketStatus.IN_PROGRESS, 'CUSTOMER')).toThrow(
      UnauthorizedAccessError,
    );

    ticket.transitionTo(TicketStatus.CLOSED, 'CUSTOMER');
    expect(ticket.status).toBe(TicketStatus.CLOSED);

    ticket.transitionTo(TicketStatus.OPEN, 'CUSTOMER');
    expect(ticket.status).toBe(TicketStatus.OPEN);
  });

  it('should throw InvalidTicketStateError for disallowed status transitions', () => {
    const ticket = Ticket.create(
      'ticket-1',
      'tenant-a',
      'customer-1',
      'Test Title',
      'Test Description',
    );

    ticket.transitionTo(TicketStatus.CLOSED, 'AGENT');
    expect(ticket.status).toBe(TicketStatus.CLOSED);

    expect(() => ticket.transitionTo(TicketStatus.WAITING_FOR_CUSTOMER, 'AGENT')).toThrow(
      InvalidTicketStateError,
    );
  });

  it('should calculate SLA deadline and determine overdue status correctly', () => {
    const ticket = Ticket.create(
      'ticket-1',
      'tenant-a',
      'customer-1',
      'Urgent bug',
      'System down',
      TicketPriority.URGENT,
    );

    const slaDeadline = ticket.getSlaDeadline();
    expect(slaDeadline.getTime() - ticket.createdAt.getTime()).toBe(1 * 60 * 60 * 1000);

    // Right now, not overdue
    expect(ticket.isOverdue(undefined, ticket.createdAt)).toBe(false);

    // 2 hours later without response -> overdue
    const twoHoursLater = new Date(ticket.createdAt.getTime() + 2 * 60 * 60 * 1000);
    expect(ticket.isOverdue(undefined, twoHoursLater)).toBe(true);

    // Once response recorded -> no longer overdue
    ticket.recordResponse(true);
    expect(ticket.isOverdue(undefined, twoHoursLater)).toBe(false);
  });

  it('should update metadata and assignees correctly', () => {
    const ticket = Ticket.create('ticket-1', 'tenant-a', 'customer-1', 'Title', 'Desc');

    ticket.updateMetadata({ title: 'New Title', priority: TicketPriority.URGENT });
    expect(ticket.title).toBe('New Title');
    expect(ticket.priority).toBe(TicketPriority.URGENT);

    ticket.assignTo('agent-99', 'team-1');
    expect(ticket.assignedAgentId).toBe('agent-99');
    expect(ticket.assignedTeamId).toBe('team-1');
  });
});
