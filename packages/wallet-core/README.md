# @amirhossein-moloki/wallet-core

Framework-agnostic wallet core domain package for the payment platform monorepo.

## Overview

`@amirhossein-moloki/wallet-core` provides exact monetary math value objects (`Money`), double-entry ledger domain primitives (`LedgerAccount`, `LedgerTransaction`, `LedgerEntry`), wallet aggregate state management (`Wallet`), wallet application orchestration service (`WalletService`), read-only reconciliation (`WalletReconciliationService`), and Medusa v2 integration adapters (`MedusaWalletPaymentProvider`, `MedusaWalletModuleService`).

## Documentation Entry Points

- [Wallet Architecture Specification (`docs/wallet-architecture.md`)](../../docs/wallet-architecture.md)
- [Wallet Integration Guide (`docs/wallet-integration-guide.md`)](../../docs/wallet-integration-guide.md)
- [Wallet AI Implementation Guide (`docs/AI_IMPLEMENTATION_GUIDE.md`)](../../docs/AI_IMPLEMENTATION_GUIDE.md) — Single source of truth for AI agents integrating wallet into `depix-ecommerce`.
- [Wallet Testing Strategy (`docs/wallet-testing.md`)](../../docs/wallet-testing.md)
- [Wallet Troubleshooting Guide (`docs/wallet-troubleshooting.md`)](../../docs/wallet-troubleshooting.md)

## Key Concepts

- **Exact Monetary Values (`Money`)**: Integer minor unit representation using `bigint` with exact arithmetic without floating-point inaccuracies.
- **Double-Entry Ledger (`LedgerTransaction`, `LedgerEntry`)**: Strict validation ensuring total debits equal total credits per currency before transaction posting. Immutable posted history.
- **Wallet Domain Aggregate (`Wallet`)**: Lifecycle states (`ACTIVE`, `FROZEN`, `CLOSED`) with strict transaction execution validation.
- **Account Balance Semantics (`LedgerAccount`)**: Explicit account types (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`) with debit/credit balance formulas.
- **Wallet Application Service (`WalletService`)**: High-level orchestration for wallet creation, verified top-up credit posting, authorized admin credit/debit with mandatory audit reasons, and checkout wallet debit.
- **Medusa v2 Integration Adapters**: `MedusaWalletPaymentProvider` (`pp_wallet`) payment provider lifecycle adapter and `MedusaWalletModuleService` module container adapter.

## Installation

```bash
pnpm add @amirhossein-moloki/wallet-core
```
