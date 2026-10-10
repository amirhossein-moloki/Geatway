# Wallet Platform Troubleshooting & Diagnostic Guide

This guide details common operational errors, failure modes, diagnostic procedures, and resolutions for the Wallet Ecosystem packages (`@amirhossein-moloki/wallet-core` and `@amirhossein-moloki/wallet-persistence-postgres`).

---

## 1. Diagnostic Decision Tree

```text
                                Wallet Failure Occurred
                                           │
          ┌────────────────────────────────┼────────────────────────────────┐
          ▼                                ▼                                ▼
[422 Insufficient Balance]     [409 Persistence Conflict]       [Database / Lock Error]
          │                                │                                │
  Check Wallet Balance           Check Idempotency Payload       Check Connection & SQL Locks
          │                                │                                │
  Verify Minor Units             Ensure Identical Body           Verify DatabaseMigrator
```

---

## 2. Common Failures and Resolutions

### Issue 1: `WalletError: Insufficient wallet balance` (HTTP 422)

- **Symptom**: `authorizePayment()` or `debitWalletForCheckout()` fails with HTTP status 422.
- **Root Cause**: The customer's available wallet balance (stored in `ledger_accounts.balance`) is lower than the requested checkout order amount.
- **Diagnostic Steps**:
  1. Inspect the customer's wallet balance using `walletService.getWalletBalance(walletId)`.
  2. Confirm whether the amount passed is in integer minor units (e.g. 500,000 IRR = 500,000 minor units).
  3. Verify if prior pending transactions reserved balance without completing.
- **Resolution**:
  - Prompt customer to top up their wallet via external payment gateway.
  - Ensure amounts passed from store cart/order match minor unit representations without decimal division.

---

### Issue 2: `PersistenceConflictError: Idempotency key conflict` (HTTP 409)

- **Symptom**: `topUpWallet()`, `debitWalletForCheckout()`, or `adminCreditWallet()` throws `PersistenceConflictError`.
- **Root Cause**: An idempotency key was reused with a transaction payload that differs from the original request payload (e.g. different amount, wallet ID, or description).
- **Diagnostic Steps**:
  1. Query `ledger_transactions` where `idempotency_key = '<key>'`.
  2. Compare the stored transaction description, entries, and amount against the incoming request.
- **Resolution**:
  - If retrying an identical request, ensure all payload attributes (amount, wallet ID, reference) match the initial attempt.
  - If initiating a distinct financial operation, generate a unique `idempotencyKey` (e.g., UUID v4).

---

### Issue 3: `CurrencyMismatchError: Currency mismatch` (HTTP 400)

- **Symptom**: Operation fails with `CurrencyMismatchError: Account currency (IRR) does not match transaction currency (USD)`.
- **Root Cause**: Attempting to post a transaction in a currency different from the target wallet or account currency.
- **Diagnostic Steps**:
  1. Inspect `wallet.currency` and target `ledger_accounts.currency`.
  2. Verify the currency code on the incoming `Money` object (`amount.currency`).
- **Resolution**:
  - Provision a separate wallet for the customer in the required currency (e.g. `createWallet(customerId, 'USD')`).
  - Convert or assert currencies match before calling `WalletService` methods.

---

### Issue 4: `InvalidAmountError: Amount must be an integer minor unit` (HTTP 400)

- **Symptom**: `Money.fromMinor()` throws `InvalidAmountError` or `TypeError`.
- **Root Cause**: Passing a floating-point number (e.g. `10.5`) to `fromMinor()`.
- **Diagnostic Steps**:
  1. Check input argument types passed to `Money.fromMinor()`.
  2. Inspect code constructing `Money` instances from store price fields.
- **Resolution**:
  - Pass integer minor units as `bigint`, integer `number`, or numeric string (e.g. `Money.fromMinor(1050n, 'USD')`).

---

### Issue 5: Database Locking Timeout / Deadlock

- **Symptom**: PostgreSQL query fails with `deadlock detected` or lock timeout during concurrent debits.
- **Root Cause**: Accounts were locked in inconsistent order across concurrent application transactions.
- **Diagnostic Steps**:
  1. Verify if `PostgresLedgerRepository` is being used.
  2. Confirm that account IDs are being sorted in ascending alphabetical order before locking.
- **Resolution**:
  - Ensure custom persistence implementations sort account IDs alphabetically (`ORDER BY id ASC`) before executing `SELECT ... FOR UPDATE`.

---

### Issue 6: `MedusaWalletPaymentProvider` Mismatched Customer Access

- **Symptom**: `initiatePayment()` or `authorizePayment()` returns `{ status: 'error', error: "Wallet '...' does not belong to customer '...'" }`.
- **Root Cause**: A customer session attempted to debit or inspect a wallet belonging to a different customer ID.
- **Diagnostic Steps**:
  1. Inspect `input.customer_id` from the authenticated Medusa session.
  2. Check `wallet.ownerId` for the target `wallet_id`.
- **Resolution**:
  - Ensure customer routes derive customer ID strictly from verified session tokens, never client-supplied body fields.
