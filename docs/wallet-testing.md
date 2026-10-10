# Wallet Testing Strategy & Verification Guide

This document specifies the testing architecture, execution commands, coverage breakdown, and verification boundaries for the Wallet Ecosystem packages (`@amirhossein-moloki/wallet-core` and `@amirhossein-moloki/wallet-persistence-postgres`).

---

## 1. Testing Architecture & Execution

The monorepo uses **Vitest** (`1.6.1`) as its primary unit and integration test runner. Tests in `@amirhossein-moloki/wallet-persistence-postgres` use `pg-mem` (`3.0.4`), an in-memory PostgreSQL emulator, allowing fast, isolated persistence testing without external database dependencies.

### Execution Commands

```bash
# Run all workspace test suites
pnpm test

# Run Wallet Core tests only
pnpm --filter @amirhossein-moloki/wallet-core test

# Run Wallet Persistence Postgres tests only
pnpm --filter @amirhossein-moloki/wallet-persistence-postgres test

# Run Depix Harness simulated integration tests
pnpm --filter depix-test test
```

---

## 2. Test Coverage Breakdown

### 2.1 Wallet Core Suite (`packages/wallet-core/tests`) — 52 Tests Passed

| Test File                    | Covered Functionality & Invariants                                                                                                                              |
| :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `money.spec.ts`              | Exact `bigint` minor-unit math, float rejection, currency match assertions, comparison, and formatting.                                                         |
| `wallet.spec.ts`             | Aggregate creation, state transitions (`ACTIVE` -> `FROZEN` -> `CLOSED`), transition guard assertions.                                                          |
| `ledger-account.spec.ts`     | Account creation (`ASSET`, `LIABILITY`, `REVENUE`), status assertions, and wallet mapping.                                                                      |
| `ledger-transaction.spec.ts` | Double-entry balancing (`sum(DEBIT) == sum(CREDIT)`), currency matching, `DRAFT` to `POSTED` transition, immutability of posted transactions.                   |
| `wallet-service.spec.ts`     | `WalletService` provisioning, top-up, admin credit/debit, checkout debit, balance lookup, and idempotency deduplication.                                        |
| `medusa-integration.spec.ts` | `MedusaWalletPaymentProvider` (`pp_wallet`) initiation, authorization, capture, cancellation, refund, customer ownership isolation checks, and error responses. |
| `reconciliation.spec.ts`     | `WalletReconciliationService` detection of unbalanced entries and stored vs derived balance mismatches.                                                         |
| `errors.spec.ts`             | Domain error hierarchy, HTTP status mapping, and serialization.                                                                                                 |

### 2.2 Wallet Persistence Suite (`packages/wallet-persistence-postgres/tests`) — 30 Tests Passed

| Test File                   | Covered Functionality & Persistence Invariants                                                                                                                       |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migration.spec.ts`         | `DatabaseMigrator` table initialization, SQL schema execution (`001_wallet_initial_schema.sql`), constraint setup, and migration idempotency.                        |
| `wallet-repository.spec.ts` | `PostgresWalletRepository` CRUD operations, status updates, metadata JSONB persistence, and owner ID index lookups.                                                  |
| `ledger-repository.spec.ts` | `PostgresLedgerRepository` atomic double-entry posting, `BIGINT` balance mutations, row locking, and idempotency key conflict handling (`PersistenceConflictError`). |
| `concurrency.spec.ts`       | High-concurrency parallel debits and top-ups, deterministic row locking (`SELECT FOR UPDATE ORDER BY id ASC`), and deadlock elimination under load.                  |
| `reconciliation.spec.ts`    | `PostgresReconciliationRepository` SQL aggregations identifying unbalanced transactions and account balance projection drift.                                        |

### 2.3 Integration Harness Suite (`examples/depix-test/tests`) — 12 Tests Passed

| Test File              | Covered Functionality                                                                                                                      |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `depix-wallet.spec.ts` | End-to-end HTTP API workflows combining payment gateway top-ups (`Zibal`, `Zarinpal`, `Mellat`, `Saman`) and wallet store checkout debits. |
| `depix-test.spec.ts`   | Multi-gateway orchestration and fallback behavior.                                                                                         |

---

## 3. Verification Boundaries & Environment Discrepancies

To ensure financial safety and technical transparency, test capabilities are categorized across verification environments:

| Feature / Guarantee                   | Unit Tested  | Emulator (`pg-mem`) | Real PostgreSQL | Real Medusa Store (`depix-ecommerce`) |
| :------------------------------------ | :----------: | :-----------------: | :-------------: | :-----------------------------------: |
| **Monetary Precision (`Money`)**      | **VERIFIED** |    **VERIFIED**     |  **VERIFIED**   |                  N/A                  |
| **Double-Entry Balancing**            | **VERIFIED** |    **VERIFIED**     |  **VERIFIED**   |                  N/A                  |
| **Row Locking (`SELECT FOR UPDATE`)** | **VERIFIED** |    **EMULATED**     | **UNVERIFIED**  |                  N/A                  |
| **Idempotency Key Deduplication**     | **VERIFIED** |    **VERIFIED**     |  **VERIFIED**   |                  N/A                  |
| **Customer Isolation (`pp_wallet`)**  | **VERIFIED** |    **VERIFIED**     |  **VERIFIED**   |            **UNVERIFIED**             |
| **End-to-End Browser Checkout**       |     N/A      |         N/A         |       N/A       |            **UNVERIFIED**             |

### Critical Environment Discrepancies:

1. **`pg-mem` vs Real PostgreSQL**:
   - `pg-mem` simulates PostgreSQL tables, indexes, and transactions in memory.
   - While SQL queries, schema constraints, and transaction rollbacks are verified in `pg-mem`, true physical PostgreSQL lock contention and multi-process socket behavior must be re-verified against a live PostgreSQL instance in staging.
2. **External Consumer Repository (`depix-ecommerce`)**:
   - `depix-ecommerce` is an external consumer repository not present in this monorepo tree.
   - End-to-end browser store checkout, Medusa admin UI wallet views, and live customer auth middleware must be tested in the consumer repository environment during staging deployment.
