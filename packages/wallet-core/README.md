# @amirhossein-moloki/wallet-core

Framework-agnostic wallet core domain package for the payment platform monorepo.

## Overview

`@amirhossein-moloki/wallet-core` provides exact monetary math value objects, double-entry ledger domain primitives, wallet aggregate state management, and repository/service port contracts.

## Key Concepts

- **Exact Monetary Values (`Money`)**: Integer minor unit representation using `bigint` with exact decimal conversion and arithmetic without floating-point inaccuracies.
- **Double-Entry Ledger (`LedgerTransaction`, `LedgerEntry`)**: Strict validation ensuring total debits equal total credits per currency before transaction posting. Immutable posted history.
- **Wallet Domain Aggregate (`Wallet`)**: Lifecycle states (`ACTIVE`, `FROZEN`, `CLOSED`) with strict transaction execution validation.
- **Account Balance Semantics (`LedgerAccount`)**: Explicit account types (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`) with debit/credit balance formulas.
