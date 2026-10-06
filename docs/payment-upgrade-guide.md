# Payment Package Ecosystem — Upgrade Guide

This guide describes versioning policies, breaking change handling, and upgrade procedures across `@company/payment-core`, `@company/payment-service`, persistence packages, and provider gateway packages.

---

## 1. Versioning Strategy

All packages in the monorepo follow [Semantic Versioning 2.0.0](https://semver.org/):

- **Major (X.0.0)**: Breaking changes to public interfaces, domain entity schemas, repository interfaces, or error structures.
- **Minor (1.X.0)**: Backward-compatible additions (e.g. new capability interfaces, new provider packages, optional fields on DTOs).
- **Patch (1.0.X)**: Backward-compatible bug fixes and performance improvements.

---

## 2. Upgrading Packages

When updating payment packages in your application's `package.json`:

```bash
# Example: Upgrading core and provider packages
pnpm update @company/payment-core @company/payment-service @company/payment-mellat @company/payment-zibal
```

_Rule_: Always keep `@company/payment-core` and `@company/payment-service` version numbers compatible.

---

## 3. Database Migration Requirements

If using `@company/payment-persistence-postgres`, package updates may include new SQL database migrations.

Run `DatabaseMigrator` during application deployment:

```ts
import { Pool } from 'pg';
import { DatabaseMigrator } from '@company/payment-persistence-postgres';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrator = new DatabaseMigrator(pool);

// Applies any pending schema migrations automatically
await migrator.up();
```
