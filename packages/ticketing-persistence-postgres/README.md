# @amirhossein-moloki/ticketing-persistence-postgres

PostgreSQL persistence implementation for `@amirhossein-moloki/ticketing-core`.

## Installation

```bash
pnpm add @amirhossein-moloki/ticketing-persistence-postgres
```

## Features

- **Database Migrations**: SQL schema migrations with tenant-scoped indexes (`001_ticketing_initial_schema.sql`, `002_ticketing_read_states_and_sla.sql`, `003_ticketing_single_tenant_defaults.sql`).
- **Tenancy Architecture Support**: Fully compatible with both `SINGLE_TENANT` and `MULTI_TENANT` modes configured in `@amirhossein-moloki/ticketing-core`.
- **Row-Level Security Alignment**: SQL queries utilize composite primary keys `(tenant_id, id)` and tenant indexes (`idx_tickets_tenant_status`, `idx_ticket_messages_tenant_ticket`, etc.).
- **Repositories**: Implements PostgreSQL repositories for tickets, messages, categories, attachments, assignments, events, and read states.
