# Ticketing Integration Guide

This guide describes how to integrate the `@amirhossein-moloki/ticketing-core` and `@amirhossein-moloki/ticketing-persistence-postgres` packages into a Node.js / TypeScript application.

---

## 1. Installation

Add workspace dependencies to your application's `package.json`:

```json
{
  "dependencies": {
    "@amirhossein-moloki/ticketing-core": "workspace:*",
    "@amirhossein-moloki/ticketing-persistence-postgres": "workspace:*"
  }
}
```

---

## 2. Database Migration Setup

```ts
import pg from 'pg';
import { DatabaseMigrator } from '@amirhossein-moloki/ticketing-persistence-postgres';
import * as path from 'path';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const migrator = new DatabaseMigrator(pool);

// Run migrations on startup (includes 001_ticketing_initial_schema.sql and 002_ticketing_read_states_and_sla.sql)
await migrator.runMigrationFiles(
  '/path/to/node_modules/@amirhossein-moloki/ticketing-persistence-postgres/migrations',
);
```

---

## 3. Instantiating Services

```ts
import { TicketingService } from '@amirhossein-moloki/ticketing-core';
import {
  PostgresTicketRepository,
  PostgresTicketMessageRepository,
  PostgresTicketCategoryRepository,
  PostgresTicketAssignmentRepository,
  PostgresTicketEventRepository,
  PostgresTicketReadStateRepository,
} from '@amirhossein-moloki/ticketing-persistence-postgres';

const ticketingService = new TicketingService({
  ticketRepository: new PostgresTicketRepository(pool),
  messageRepository: new PostgresTicketMessageRepository(pool),
  categoryRepository: new PostgresTicketCategoryRepository(pool),
  assignmentRepository: new PostgresTicketAssignmentRepository(pool),
  eventRepository: new PostgresTicketEventRepository(pool),
  readStateRepository: new PostgresTicketReadStateRepository(pool),
});
```

---

## 4. Usage Example

```ts
const tenantCtx = {
  tenantId: 'store-100',
  userId: 'user-42',
  userRole: 'CUSTOMER' as const,
};

// Create a new support ticket
const { ticket, message } = await ticketingService.createTicket(tenantCtx, {
  title: 'Order Status Query',
  description: 'When will order #1234 ship?',
  priority: TicketPriority.MEDIUM,
});

// Agent reply
const agentCtx = {
  tenantId: 'store-100',
  userId: 'agent-1',
  userRole: 'AGENT' as const,
};

await ticketingService.addMessage(agentCtx, ticket.id, {
  content: 'Your order is currently being packaged.',
});

// Mark as read & check unread count
await ticketingService.markTicketAsRead(tenantCtx, ticket.id);
const unreadCount = await ticketingService.getUnreadCount(tenantCtx);

// Bulk update tickets (Agent/Admin)
await ticketingService.bulkUpdateTickets(agentCtx, [ticket.id], {
  status: TicketStatus.IN_PROGRESS,
  assignedAgentId: 'agent-1',
});

// SLA Metrics & Reports
const slaMetrics = await ticketingService.getSlaMetrics(agentCtx);
const report = await ticketingService.getOperationalReport(agentCtx);
```
