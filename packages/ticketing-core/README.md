# @amirhossein-moloki/ticketing-core

Framework-agnostic core ticketing domain model, configurable tenancy architecture (Single-Tenant and Multi-Tenant), state machine transitions, role-based authorization, and service ports.

## Installation

```bash
pnpm add @amirhossein-moloki/ticketing-core
```

## Configurable Tenancy Architecture

The ticketing package supports both **Single-Tenant Mode** and **Multi-Tenant Mode** through explicit package configuration (`TenancyConfig`).

### 1. Selecting Tenancy Mode

Tenancy mode is specified when initializing `TicketingService`:

#### Single-Tenant Mode

Ideal for single-store, single-organization, or monosite installations.

```ts
import { TicketingService } from '@amirhossein-moloki/ticketing-core';

const ticketingService = new TicketingService({
  ticketRepository,
  messageRepository,
  tenancyConfig: {
    mode: 'SINGLE_TENANT',
    defaultTenantId: 'default', // Optional, defaults to 'default'
  },
});
```

**Single-Tenant Behavior:**

- `tenantId` is **optional** in `TenantContext`. If omitted, the service automatically normalizes requests to `defaultTenantId`.
- No store or organization management modules are required.
- **Security Guarantees:** Normal user-level, ownership, and role authorization (`CUSTOMER`, `AGENT`, `TENANT_ADMIN`, `PLATFORM_ADMIN`) remains **strictly enforced**. Customers can only access their own tickets (`customerId === userId`).
- Attachments, notifications, search, reports, SLA metrics, background jobs, and audit history function seamlessly without requiring callers to supply a `tenantId`.

#### Multi-Tenant Mode

Ideal for multi-store platforms and SaaS applications serving isolated tenants.

```ts
import { TicketingService } from '@amirhossein-moloki/ticketing-core';

const ticketingService = new TicketingService({
  ticketRepository,
  messageRepository,
  tenancyConfig: {
    mode: 'MULTI_TENANT',
  },
});
```

**Multi-Tenant Behavior:**

- `tenantId` is **mandatory** in `TenantContext`.
- Missing or empty `tenantId` triggers a `TenantMismatchError`.
- Multi-Tenant Mode **never** silently falls back to unscoped queries or default tenant IDs.
- Cross-tenant data access is strictly prevented across tickets, messages, attachments, assignments, categories, notifications, background jobs, searches, reports, and audit history.

---

## Configuration Reference

```ts
export type TenancyMode = 'SINGLE_TENANT' | 'MULTI_TENANT';

export interface TenancyConfig {
  mode: TenancyMode;
  defaultTenantId?: string;
}
```

If `tenancyConfig` is omitted during `TicketingService` initialization, it defaults to `mode: 'MULTI_TENANT'`. Providing an invalid `mode` string throws an `InvalidTenancyConfigError`.

---

## Schema and Migration Guidelines

- **Database Compatibility:** Both tenancy modes share the same schema structure (`tenant_id VARCHAR(255) NOT NULL` and composite primary keys `(tenant_id, id)`). Multi-tenant isolation constraints are never weakened.
- **Single-Tenant Records:** In Single-Tenant Mode, records are stored with `tenant_id = defaultTenantId` (e.g. `'default'`), fully leveraging tenant indexes.
- **Upgrading Single-Tenant to Multi-Tenant:**
  1. Backfill existing records to assign them a specific tenant ID:
     ```sql
     UPDATE tickets SET tenant_id = 'org_001' WHERE tenant_id = 'default';
     UPDATE ticket_categories SET tenant_id = 'org_001' WHERE tenant_id = 'default';
     UPDATE ticket_messages SET tenant_id = 'org_001' WHERE tenant_id = 'default';
     UPDATE ticket_attachments SET tenant_id = 'org_001' WHERE tenant_id = 'default';
     UPDATE ticket_assignments SET tenant_id = 'org_001' WHERE tenant_id = 'default';
     UPDATE ticket_events SET tenant_id = 'org_001' WHERE tenant_id = 'default';
     UPDATE ticket_read_states SET tenant_id = 'org_001' WHERE tenant_id = 'default';
     ```
  2. Update package configuration to `{ mode: 'MULTI_TENANT' }`.

---

## Key Features

- **Configurable Tenancy**: Explicit single-tenant and multi-tenant mode execution.
- **Role Permissions**: Customer, Agent, Tenant Admin, and Platform Admin permissions.
- **Internal Notes Privacy**: Internal agent notes are automatically filtered from customer conversations.
- **State Machine**: Enforced status transition rules.
- **Domain Service**: High-level `TicketingService` orchestrator for categories, tickets, assignments, SLA metrics, operational reports, and event notifications.
