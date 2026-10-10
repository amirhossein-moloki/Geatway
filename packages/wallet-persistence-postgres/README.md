# @amirhossein-moloki/wallet-persistence-postgres

PostgreSQL persistence implementation for the wallet domain in the payment platform monorepo.

## Overview

`@amirhossein-moloki/wallet-persistence-postgres` provides PostgreSQL repository implementations for `@amirhossein-moloki/wallet-core` domain contracts (`PostgresWalletRepository`, `PostgresLedgerRepository`, `PostgresReconciliationRepository`) and schema migration execution utilities (`DatabaseMigrator`).

## Documentation Entry Points

- [Wallet Architecture Specification (`docs/wallet-architecture.md`)](../../docs/wallet-architecture.md)
- [Wallet Integration Guide (`docs/wallet-integration-guide.md`)](../../docs/wallet-integration-guide.md)
- [Wallet AI Implementation Guide (`docs/AI_IMPLEMENTATION_GUIDE.md`)](../../docs/AI_IMPLEMENTATION_GUIDE.md) — Single source of truth for AI agents integrating wallet into `depix-ecommerce`.
- [Wallet Testing Strategy (`docs/wallet-testing.md`)](../../docs/wallet-testing.md)
- [Wallet Troubleshooting Guide (`docs/wallet-troubleshooting.md`)](../../docs/wallet-troubleshooting.md)

## Features

- Durable storage for wallets, ledger accounts, ledger transactions, and ledger entries.
- Exact monetary precision using PostgreSQL `BIGINT` minor units.
- Atomic ledger transaction posting using PostgreSQL database transactions (`withTransaction`).
- Concurrency-safe balance operations using deterministic row-level locks (`SELECT ... FOR UPDATE ORDER BY id ASC`).
- Double-entry accounting integrity enforcement (`sum(DEBIT) == sum(CREDIT)`).
- Immutable ledger history protection.
- Idempotency key conflict detection and deduplication.
- Schema migrations engine (`DatabaseMigrator`) running `001_wallet_initial_schema.sql`.

## Installation

```bash
pnpm add @amirhossein-moloki/wallet-persistence-postgres pg
```
