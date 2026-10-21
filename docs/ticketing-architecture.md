# Ticketing Architecture & Multi-Tenant Design Specification

This document details the architectural specification for the Ticketing platform within `payment-platform-monorepo`.

---

## 1. System Overview & Boundaries

The Ticketing platform provides a framework-agnostic multi-tenant support ticketing aggregate, conversation history, internal note privacy, attachments support, assignment tracking, SLA response management, read state tracking, bulk administrative operations, and event auditing system.

### Package Boundaries

```text
  Consumer Application / Storefront
                 │
                 ▼
 ┌───────────────────────────────────────────────┐
 │   @amirhossein-moloki/ticketing-core          │
 │  - Domain Entities (Ticket, Message, SLA, etc)│
 │  - TicketingService Domain Orchestrator       │
 │  - TenantContext Validation & Role Rules      │
 │  - Repository & Integration Ports             │
 └───────────────────────┬───────────────────────┘
                         │
                         ▼
 ┌───────────────────────────────────────────────┐
 │ @amirhossein-moloki/ticketing-persistence-    │
 │                  postgres                     │
 │  - Postgres Repositories                      │
 │  - Explicit WHERE tenant_id = $1 Isolation    │
 │  - DatabaseMigrator & SQL Migrations          │
 └───────────────────────┬───────────────────────┘
                         │
                         ▼
               PostgreSQL Database
```

---

## 2. Multi-Tenant Data Isolation Strategy

Multi-tenancy is strictly enforced across every layer:

1. **`TenantContext` Invariant**:
   Every service operation requires a validated `TenantContext`:
   ```ts
   export interface TenantContext {
     tenantId: string;
     userId: string;
     userRole: 'CUSTOMER' | 'AGENT' | 'TENANT_ADMIN' | 'PLATFORM_ADMIN';
     teamIds?: string[];
   }
   ```
2. **Customer Isolation**:
   When `userRole === 'CUSTOMER'`, ticket queries force `customerId = userId`. Customers can never inspect or modify tickets belonging to other customers.

3. **Internal Note Privacy**:
   Messages with `visibility === 'INTERNAL'` are hidden when queried by a customer. Attempts by a customer to post an internal note throw `UnauthorizedAccessError`.

4. **PostgreSQL Row-Level Compound Key Isolation**:
   All database tables employ compound primary keys `(tenant_id, id)` and foreign key references `(tenant_id, ticket_id)`. Every SQL query explicitly enforces `WHERE tenant_id = $1`.

---

## 3. Ticket Lifecycle State Machine

```text
               ┌──────────┐
               │   OPEN   │
               └────┬─────┘
                    │
                    ▼
          ┌───────────────────┐
          │    IN_PROGRESS    │◄─────────────┐
          └─────────┬─────────┘              │
                    │                        │
        ┌───────────┴───────────┐            │ Reopen
        ▼                       ▼            │
┌───────────────┐       ┌───────────────┐    │
│  WAITING_FOR_ │       │  WAITING_FOR_ │    │
│   CUSTOMER    │       │     AGENT     │    │
└───────┬───────┘       └───────┬───────┘    │
        │                       │            │
        └───────────┬───────────┘            │
                    ▼                        │
               ┌──────────┐                  │
               │ RESOLVED │──────────────────┤
               └────┬─────┘                  │
                    │                        │
                    ▼                        │
               ┌──────────┐                  │
               │  CLOSED  │──────────────────┘
               └──────────┘
```

Allowed transitions are strictly validated by `ticket.transitionTo(targetStatus, actorRole)`. Customer role is restricted to transition tickets to `CLOSED` or `OPEN` (reopen).

---

## 4. SLA & Response Management

SLA target response hours per priority:
- `URGENT`: 1 hour
- `HIGH`: 4 hours
- `MEDIUM`: 24 hours
- `LOW`: 48 hours

A ticket is considered overdue if it is not in `RESOLVED` or `CLOSED` state, has no `firstResponseAt`, and current time exceeds `createdAt + slaTargetHours`.

---

## 5. Read States & Unread Counting

Read states are tracked per tenant, ticket, and user in table `ticket_read_states`:
- `markTicketAsRead(ctx, ticketId)` upserts the timestamp when a user reads a ticket.
- `getUnreadCount(ctx)` calculates tickets with messages newer than `last_read_at`.

---

## 6. Bulk Operations & Privacy

- `bulkUpdateTickets`: Executes status, assignment, priority, or category updates across multiple tickets with per-record authorization and safe failure handling.
- `anonymizeCustomerData`: Admin-only utility for GDPR/privacy compliance that redacts PII while retaining ticket audit structures.
