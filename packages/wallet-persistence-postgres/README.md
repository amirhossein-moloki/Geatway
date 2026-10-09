# @amirhossein-moloki/wallet-persistence-postgres

PostgreSQL persistence implementation for the wallet domain in the payment platform.

## Features

- Durable storage for wallets, ledger accounts, ledger transactions, and ledger entries.
- Exact monetary precision using PostgreSQL `BIGINT` minor units.
- Atomic ledger transaction posting using PostgreSQL database transactions.
- Concurrency-safe balance operations using deterministic row-level locks (`SELECT ... FOR UPDATE`).
- Double-entry accounting integrity enforcement.
- Immutable ledger history protection.
- Idempotency key conflict detection and deduplication.
