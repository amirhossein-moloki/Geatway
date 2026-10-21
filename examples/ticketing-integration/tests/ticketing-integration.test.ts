import { describe, expect, it, beforeEach } from 'vitest';
import { newDb, DataType } from 'pg-mem';
import {
  TicketingService,
  MessageVisibility,
  TicketStatus,
} from '@amirhossein-moloki/ticketing-core';
import {
  DatabaseMigrator,
  PgExecutor,
  PostgresTicketAssignmentRepository,
  PostgresTicketAttachmentRepository,
  PostgresTicketCategoryRepository,
  PostgresTicketEventRepository,
  PostgresTicketMessageRepository,
  PostgresTicketReadStateRepository,
  PostgresTicketRepository,
} from '@amirhossein-moloki/ticketing-persistence-postgres';
import { TicketingHttpController } from '../src/server.js';
import * as path from 'path';

async function setupDatabase(): Promise<PgExecutor> {
  const db = newDb();
  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 15.0 (pg-mem)',
  });

  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();

  const migrator = new DatabaseMigrator(pool as unknown as PgExecutor);
  const migrationsDir = path.join(
    __dirname,
    '../../../packages/ticketing-persistence-postgres/migrations',
  );
  await migrator.runMigrationFiles(migrationsDir);

  return pool as unknown as PgExecutor;
}

describe('Ticketing Integration Example Test Suite', () => {
  let controller: TicketingHttpController;

  beforeEach(async () => {
    const db = await setupDatabase();
    const categoryRepo = new PostgresTicketCategoryRepository(db);
    const ticketRepo = new PostgresTicketRepository(db);
    const messageRepo = new PostgresTicketMessageRepository(db);
    const attachmentRepo = new PostgresTicketAttachmentRepository(db);
    const assignmentRepo = new PostgresTicketAssignmentRepository(db);
    const eventRepo = new PostgresTicketEventRepository(db);
    const readStateRepo = new PostgresTicketReadStateRepository(db);

    const ticketingService = new TicketingService({
      ticketRepository: ticketRepo,
      messageRepository: messageRepo,
      categoryRepository: categoryRepo,
      attachmentRepository: attachmentRepo,
      assignmentRepository: assignmentRepo,
      eventRepository: eventRepo,
      readStateRepository: readStateRepo,
    });

    controller = new TicketingHttpController(ticketingService);
  });

  it('should handle end-to-end customer ticket creation and agent conversation via controller', async () => {
    // 1. Admin creates category
    const catReq = {
      headers: {
        'x-tenant-id': 'store-alpha',
        'x-user-id': 'admin-1',
        'x-user-role': 'TENANT_ADMIN',
      },
      body: { name: 'Logistics', description: 'Shipping & Delivery' },
    };
    const catRes = await controller.handleCreateCategory(catReq);
    expect(catRes.status).toBe(201);
    const categoryId = (catRes.body as any).category.id;

    // 2. Customer creates ticket with category
    const createReq = {
      headers: {
        'x-tenant-id': 'store-alpha',
        'x-user-id': 'cust-100',
        'x-user-role': 'CUSTOMER',
      },
      body: {
        title: 'Where is my delivery?',
        description: 'Order #5544 has not arrived.',
        categoryId,
      },
    };

    const createRes = await controller.handleCreateTicket(createReq);
    expect(createRes.status).toBe(201);
    const ticketId = (createRes.body as any).ticket.id;
    expect(ticketId).toBeDefined();

    // 3. Agent replies publicly and changes assignment
    const agentMsgReq = {
      headers: {
        'x-tenant-id': 'store-alpha',
        'x-user-id': 'agent-7',
        'x-user-role': 'AGENT',
      },
      params: { ticketId },
      body: {
        content: 'Checking with logistics carrier now.',
        visibility: MessageVisibility.PUBLIC,
      },
    };

    const agentMsgRes = await controller.handleAddMessage(agentMsgReq);
    expect(agentMsgRes.status).toBe(201);

    // 4. Agent adds internal note
    const agentInternalReq = {
      headers: {
        'x-tenant-id': 'store-alpha',
        'x-user-id': 'agent-7',
        'x-user-role': 'AGENT',
      },
      params: { ticketId },
      body: {
        content: 'Carrier tracking ID is ABC123XYZ',
        visibility: MessageVisibility.INTERNAL,
      },
    };

    await controller.handleAddMessage(agentInternalReq);

    // 5. Customer retrieves ticket conversation (should NOT see internal note)
    const getReqCustomer = {
      headers: {
        'x-tenant-id': 'store-alpha',
        'x-user-id': 'cust-100',
        'x-user-role': 'CUSTOMER',
      },
      params: { ticketId },
    };

    const getResCustomer = await controller.handleGetTicket(getReqCustomer);
    expect(getResCustomer.status).toBe(200);
    const messagesCust = (getResCustomer.body as any).messages;
    expect(messagesCust).toHaveLength(2); // initial + public agent reply
    expect(messagesCust.some((m: any) => m.content.includes('tracking ID'))).toBe(false);

    // 6. Agent performs bulk status update
    const bulkReq = {
      headers: {
        'x-tenant-id': 'store-alpha',
        'x-user-id': 'agent-7',
        'x-user-role': 'AGENT',
      },
      body: {
        ticketIds: [ticketId],
        status: TicketStatus.RESOLVED,
      },
    };
    const bulkRes = await controller.handleBulkUpdateStatus(bulkReq);
    expect(bulkRes.status).toBe(200);
    expect((bulkRes.body as any).success).toContain(ticketId);

    // 7. Get metrics
    const metricsReq = {
      headers: {
        'x-tenant-id': 'store-alpha',
        'x-user-id': 'admin-1',
        'x-user-role': 'TENANT_ADMIN',
      },
    };
    const metricsRes = await controller.handleGetMetrics(metricsReq);
    expect(metricsRes.status).toBe(200);
    expect((metricsRes.body as any).metrics.totalTickets).toBe(1);

    // 8. Cross-tenant security check from store-beta
    const crossReq = {
      headers: {
        'x-tenant-id': 'store-beta',
        'x-user-id': 'cust-100',
        'x-user-role': 'CUSTOMER',
      },
      params: { ticketId },
    };

    const crossRes = await controller.handleGetTicket(crossReq);
    expect(crossRes.status).toBe(404);
  });
});
