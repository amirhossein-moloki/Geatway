> **HISTORICAL AUDIT REPORT**
> _This document is a historical integration audit report generated on March 6, 2026. For active development and integration specifications, refer to [Wallet Architecture](./wallet-architecture.md), [Wallet Integration Guide](./wallet-integration-guide.md), and [AI Implementation Guide](./AI_IMPLEMENTATION_GUIDE.md)._

---

# Wallet Integration Audit & Staging Verification Report

## Executive Summary

This report documents the integration audit, test suite implementation, accounting ledger verification, and staging readiness assessment for the Medusa v2 Wallet ecosystem (`@amirhossein-moloki/wallet-core`, `@amirhossein-moloki/wallet-persistence-postgres`, and `examples/depix-test`).

---

## 1. Environment & Accessibility Inspection

| Environment / Target                                                 | Status       | Notes                                                             |
| :------------------------------------------------------------------- | :----------- | :---------------------------------------------------------------- |
| **Monorepo Packages (`wallet-core`, `wallet-persistence-postgres`)** | **VERIFIED** | All unit and domain integration tests pass cleanly.               |
| **Simulated Integration Suite (`depix-test`)**                       | **VERIFIED** | HTTP API integration server and test suite pass cleanly.          |
| **External Consumer Application (`depix-ecommerce`)**                | **BLOCKED**  | Repository is not present in the workspace/environment.           |
| **Live Staging Infrastructure / Database**                           | **BLOCKED**  | Live staging server/database is inaccessible in this environment. |

---

## 2. Accounting & Double-Entry Ledger Mapping

Every wallet operation in `@amirhossein-moloki/wallet-core` produces a balanced double-entry `LedgerTransaction` (where sum of DEBIT amounts equals sum of CREDIT amounts).

### Accounting Operations Table

| Operation                       | Debit Account                              | Credit Account                                  | Business & Accounting Meaning                                                                               |
| :------------------------------ | :----------------------------------------- | :---------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| **Online Top-Up**               | `system-cash-account_<currency>` (Asset +) | `acc_bal_<walletId>` (Liability +)              | External cash received into platform bank/cash clearing; increases liability owed to customer stored value. |
| **Wallet Checkout**             | `acc_bal_<walletId>` (Liability -)         | `system-revenue-account_<currency>` (Revenue +) | Customer redeems wallet value to pay for order; reduces customer liability and recognizes sales revenue.    |
| **Admin Credit**                | `system-cash-account_<currency>` (Asset +) | `acc_bal_<walletId>` (Liability +)              | Platform manually credits stored value to customer wallet; funded from cash/system clearing account.        |
| **Admin Debit**                 | `acc_bal_<walletId>` (Liability -)         | `system-cash-account_<currency>` (Asset -)      | Platform manually reclaims customer wallet stored value; reduces wallet liability.                          |
| **Order Cancellation / Refund** | `system-cash-account_<currency>` (Asset +) | `acc_bal_<walletId>` (Liability +)              | Refund credits customer wallet balance via `adminCreditWallet`.                                             |

### Accounting Policy Flags & Review Recommendations

1. **Order Refund Accounting Flag**:
   - `refundPayment` delegates to `adminCreditWallet`, which debits `system-cash-account` (Asset +) and credits customer wallet balance (Liability +).
   - If business accounting rules require debiting Sales Revenue or Sales Returns instead of Cash Asset during order refunds, a dedicated refund ledger transaction method should be introduced in the application service layer.
