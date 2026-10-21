# Ticketing Architecture & Multi-Tenant Design Specification

This document details the architectural specification for the Ticketing platform within `payment-platform-monorepo`.

---

## 1. System Overview & Boundaries

The Ticketing platform provides a framework-agnostic multi-tenant support ticketing aggregate, conversation history, internal note privacy, attachments support, assignment tracking, and event auditing system.

### Package Boundaries

```text
  Consumer Application / Storefront
                 │
                 ▼
 ┌───────────────────────────────────────────────┐
 │   @amirhossein-moloki/ticketing-core          │
 │  - Domain Entities (Ticket, Message, etc.)    │
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

Allowed transitions are strictly validated by `ticket.transitionTo(targetStatus)`.
