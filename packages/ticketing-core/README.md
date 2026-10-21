# @amirhossein-moloki/ticketing-core

Framework-agnostic core ticketing domain model, multi-tenant data isolation, state machine transitions, and service ports.

## Installation

```bash
pnpm add @amirhossein-moloki/ticketing-core
```

## Features

- **Multi-Tenant Isolation**: Verified `TenantContext` on every operation.
- **Role Permissions**: Customer, Agent, Tenant Admin, and Platform Admin roles.
- **Internal Notes Privacy**: Internal agent notes are filtered automatically from customer conversations.
- **State Machine**: Enforced status transition validation.
- **Domain Service**: High-level `TicketingService` orchestrator.
