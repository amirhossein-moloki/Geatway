# Wallet Platform Integration Guide

This guide provides step-by-step instructions for developers integrating the Wallet Ecosystem packages (`@amirhossein-moloki/wallet-core` and `@amirhossein-moloki/wallet-persistence-postgres`) into target applications, including Medusa v2 applications (`depix-ecommerce`).

---

## 1. Package Overview & Installation

The wallet ecosystem consists of two core packages published to GitHub Packages (`https://npm.pkg.github.com`):

| Package Name                                          | Purpose                                                                                                                                                          | Dependencies                        |
| :---------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| **`@amirhossein-moloki/wallet-core`**                 | Domain entities (`Wallet`, `Money`, `LedgerAccount`), application service (`WalletService`), reconciliation, and Medusa v2 adapters (`pp_wallet`).               | `@amirhossein-moloki/payment-core`  |
| **`@amirhossein-moloki/wallet-persistence-postgres`** | PostgreSQL repositories (`PostgresWalletRepository`, `PostgresLedgerRepository`, `PostgresReconciliationRepository`) and schema migrations (`DatabaseMigrator`). | `wallet-core`, `payment-core`, `pg` |

### Step 1.1: Configure `.npmrc`

Add GitHub Packages registry configuration to your target project's `.npmrc`:

```ini
@amirhossein-moloki:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Step 1.2: Install Packages

Install the required dependencies:

```bash
pnpm add @amirhossein-moloki/wallet-core @amirhossein-moloki/wallet-persistence-postgres pg
```

---

## 2. PostgreSQL Schema & Database Migrations

### Step 2.1: Schema Structures

The wallet persistence layer creates 5 primary tables:

1. **`wallets`**: Stores wallet state (`ACTIVE`, `FROZEN`, `CLOSED`), currency, and owner ID.
2. **`ledger_accounts`**: Stores double-entry accounts with exact `BIGINT` minor-unit balances.
3. **`ledger_transactions`**: Stores financial transaction headers (`DRAFT`, `POSTED`, `REJECTED`) and idempotency keys.
4. **`ledger_entries`**: Line entries linked to transactions and accounts (`DEBIT` or `CREDIT` with `BIGINT` amount).
5. **`schema_migrations`**: Migration execution tracking table.

### Step 2.2: Execute Database Migrations

Run `DatabaseMigrator` during application startup or deployment pipeline:

```typescript
import { Client } from 'pg';
import { DatabaseMigrator } from '@amirhossein-moloki/wallet-persistence-postgres';

async function migrateDatabase() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const migrator = new DatabaseMigrator(client);

  // Applies 001_wallet_initial_schema.sql idempotently
  const sql = `
    CREATE TABLE IF NOT EXISTS wallets (
      id VARCHAR(64) PRIMARY KEY,
      owner_id VARCHAR(64) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wallets_owner_id ON wallets(owner_id);

    CREATE TABLE IF NOT EXISTS ledger_accounts (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(32) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
      currency VARCHAR(10) NOT NULL,
      wallet_id VARCHAR(64) NULL REFERENCES wallets(id) ON DELETE RESTRICT,
      status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
      balance BIGINT NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_accounts_wallet_id ON ledger_accounts(wallet_id);

    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id VARCHAR(64) PRIMARY KEY,
      description TEXT NOT NULL,
      idempotency_key VARCHAR(255) NULL,
      reference VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL CHECK (status IN ('DRAFT', 'POSTED', 'REJECTED')),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      posted_at TIMESTAMPTZ NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uk_ledger_transactions_idempotency_key
      ON ledger_transactions(idempotency_key)
      WHERE idempotency_key IS NOT NULL;

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id VARCHAR(64) PRIMARY KEY,
      transaction_id VARCHAR(64) NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
      account_id VARCHAR(64) NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
      direction VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
      amount BIGINT NOT NULL CHECK (amount > 0),
      currency VARCHAR(10) NOT NULL,
      memo TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id ON ledger_entries(account_id);
  `;

  await migrator.runMigration('001_wallet_initial_schema.sql', sql);
  await client.end();
}
```

---

## 3. Initializing Wallet Domain Services

```typescript
import { Pool } from 'pg';
import { WalletService } from '@amirhossein-moloki/wallet-core';
import {
  PostgresWalletRepository,
  PostgresLedgerRepository,
} from '@amirhossein-moloki/wallet-persistence-postgres';

// 1. Initialize PostgreSQL Connection Pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. Instantiate PostgreSQL Repositories
const walletRepo = new PostgresWalletRepository(pool);
const ledgerRepo = new PostgresLedgerRepository(pool);

// 3. Instantiate Wallet Domain Service
export const walletService = new WalletService({
  walletRepository: walletRepo,
  ledgerRepository: ledgerRepo,
  systemCashAccountId: 'system-cash-account',
  systemRevenueAccountId: 'system-revenue-account',
});
```

---

## 4. Operational API Examples

### 4.1 Provisioning Customer Wallet

Creates a new wallet aggregate and automatically provisions a customer balance liability account (`acc_bal_<walletId>`):

```typescript
const { wallet, balanceAccount } = await walletService.createWallet('cust_1001', 'IRR');
console.log(wallet.id); // 'wlt_...'
console.log(balanceAccount.id); // 'acc_bal_wlt_...'
```

### 4.2 Querying Wallet Balance

```typescript
import { Money } from '@amirhossein-moloki/wallet-core';

const balance: Money = await walletService.getWalletBalance(wallet.id);
console.log(balance.amount); // BigInt (e.g., 500000n)
console.log(balance.currency); // 'IRR'
```

### 4.3 Verified Online Top-Up

Executes double-entry posting (`DEBIT System Cash Asset`, `CREDIT Customer Balance Liability`) following payment gateway verification:

```typescript
import { Money } from '@amirhossein-moloki/wallet-core';

const amount = Money.fromMinor(500000n, 'IRR');

const tx = await walletService.topUpWallet({
  walletId: wallet.id,
  amount,
  reference: 'ipg_tx_998877',
  idempotencyKey: 'topup_order_5001',
  metadata: { paymentGateway: 'zibal' },
});

console.log(tx.status); // 'POSTED'
```

### 4.4 E-Commerce Checkout Debit

Executes double-entry posting (`DEBIT Customer Balance Liability`, `CREDIT System Revenue`) for store order checkout:

```typescript
const amount = Money.fromMinor(150000n, 'IRR');

const tx = await walletService.debitWalletForCheckout({
  walletId: wallet.id,
  amount,
  orderId: 'order_8820',
  idempotencyKey: 'checkout_order_8820',
});

console.log(tx.id); // 'tx_chk_...'
```

### 4.5 Administrative Credit & Debit

Administrative adjustments require `adminId`, audit `reason`, positive monetary amount, and idempotency key:

```typescript
// Administrative Credit (e.g. promotional grant or manual refund)
await walletService.adminCreditWallet({
  walletId: wallet.id,
  amount: Money.fromMinor(50000n, 'IRR'),
  reason: 'VIP Promotional Goodwill Credit',
  adminId: 'admin_usr_42',
  idempotencyKey: 'adm_cred_promo_cust1001_v1',
});

// Administrative Debit (e.g. chargeback recovery or manual correction)
await walletService.adminDebitWallet({
  walletId: wallet.id,
  amount: Money.fromMinor(20000n, 'IRR'),
  reason: 'Correction for over-credited promo',
  adminId: 'admin_usr_42',
  idempotencyKey: 'adm_deb_corr_cust1001_v1',
});
```

---

## 5. Medusa v2 Integration Guide (`depix-ecommerce`)

### Step 5.1: Register Provider (`MedusaWalletPaymentProvider`)

Register `MedusaWalletPaymentProvider` under identifier `pp_wallet` in Medusa payment configuration:

```typescript
import { MedusaWalletPaymentProvider } from '@amirhossein-moloki/wallet-core';

// Pass initialized WalletService to provider constructor
const walletPaymentProvider = new MedusaWalletPaymentProvider(walletService);
```

### Step 5.2: Provider Lifecycle Capabilities

| Provider Method      | Input Context                                                  | Wallet Domain Action                                                               | Result Status           |
| :------------------- | :------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :---------------------- |
| `initiatePayment()`  | `{ amount, currency_code, customer_id, wallet_id }`            | Validates customer ownership and checks sufficient balance via `getWalletBalance`. | `pending` or `error`    |
| `authorizePayment()` | `paymentSessionData`, `idempotencyKey`, `orderId`              | Posts double-entry debit via `debitWalletForCheckout`.                             | `authorized` or `error` |
| `capturePayment()`   | `paymentData`                                                  | Confirms captured status (debit posted during authorization).                      | `captured`              |
| `cancelPayment()`    | `paymentData`                                                  | Confirms canceled status.                                                          | `canceled`              |
| `refundPayment()`    | `paymentData`, `refundAmountMinor`, `reason`, `idempotencyKey` | Posts system refund credit via `adminCreditWallet`.                                | `captured` or `error`   |

### Step 5.3: Security & Customer Isolation Requirements

1. **Authenticated Customer Verification**: Customer endpoints must derive customer identity strictly from verified session tokens (`req.auth_context.actor_id`), never client-supplied request bodies.
2. **Wallet Ownership Validation**: `MedusaWalletPaymentProvider` asserts that `wallet.ownerId === customer_id` before processing checkout debits or refunds.
3. **Idempotency Mandatory**: All debit, top-up, and refund requests require non-empty idempotency keys. Re-submitting duplicate idempotency keys with identical payloads safely returns the previously posted transaction.
