# @amirhossein-moloki/ticketing-persistence-postgres

PostgreSQL persistence implementation for `@amirhossein-moloki/ticketing-core`.

## Installation

```bash
pnpm add @amirhossein-moloki/ticketing-persistence-postgres
```

## Features

- **Database Migrations**: SQL schema migrations with tenant-scoped indexes.
- **Strict Row Isolation**: Explicit `WHERE tenant_id = $1` filters on all queries.
- **Repositories**: Implements `ITicketRepository`, `ITicketMessageRepository`, etc.
