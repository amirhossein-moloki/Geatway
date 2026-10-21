# Ticketing Integration Example

This example demonstrates how to integrate `@amirhossein-moloki/ticketing-core` and `@amirhossein-moloki/ticketing-persistence-postgres` into an HTTP REST application.

## Key Features

- Multi-tenant headers (`x-tenant-id`, `x-user-id`, `x-user-role`).
- Customer vs Agent access control.
- Internal note privacy filtering.
- PostgreSQL database persistence via `DatabaseMigrator`.

## Running Tests

```bash
pnpm test
```
