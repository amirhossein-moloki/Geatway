# @amirhossein-moloki/wallet-core

Framework-agnostic wallet core domain package for the payment platform monorepo.

## Overview

`@amirhossein-moloki/wallet-core` provides exact monetary math value objects, double-entry ledger domain primitives, wallet aggregate state management, wallet application orchestration service (`WalletService`), and repository/service port contracts.

## Key Concepts

- **Exact Monetary Values (`Money`)**: Integer minor unit representation using `bigint` with exact decimal conversion and arithmetic without floating-point inaccuracies.
- **Double-Entry Ledger (`LedgerTransaction`, `LedgerEntry`)**: Strict validation ensuring total debits equal total credits per currency before transaction posting. Immutable posted history.
- **Wallet Domain Aggregate (`Wallet`)**: Lifecycle states (`ACTIVE`, `FROZEN`, `CLOSED`) with strict transaction execution validation.
- **Account Balance Semantics (`LedgerAccount`)**: Explicit account types (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`) with debit/credit balance formulas.
- **Wallet Application Service (`WalletService`)**: High-level orchestration for wallet creation, verified top-up credit posting, authorized admin credit/debit with mandatory audit reasons, and checkout wallet debit.

---

## Medusa v2 Application Integration Specification (`depix-ecommerce`)

This section documents the integration contracts and boundary requirements for connecting `@amirhossein-moloki/wallet-core` to the consumer Medusa v2 store application (`depix-ecommerce`).

_Note: The consumer store `depix-ecommerce` is an external repository that is deployed independently from this payment platform monorepo._

### 1. Medusa Module Boundary (`WalletModule`)

To register the wallet domain within Medusa v2, create a dedicated Medusa module:

```typescript
// src/modules/wallet/index.ts
import { Module } from '@medusajs/framework/utils';
import { WalletModuleService } from './service';

export const WALLET_MODULE = 'wallet';

export default Module(WALLET_MODULE, {
  service: WalletModuleService,
});
```

```typescript
// src/modules/wallet/service.ts
import {
  WalletService,
  Money,
  IWalletRepository,
  ILedgerRepository,
} from '@amirhossein-moloki/wallet-core';
import {
  PostgresWalletRepository,
  PostgresLedgerRepository,
} from '@amirhossein-moloki/wallet-persistence-postgres';

export class WalletModuleService {
  private readonly walletService: WalletService;

  constructor(container: any) {
    const pgExecutor = container.pgExecutor; // DB pool executor
    const walletRepo = new PostgresWalletRepository(pgExecutor);
    const ledgerRepo = new PostgresLedgerRepository(pgExecutor);

    this.walletService = new WalletService({
      walletRepository: walletRepo,
      ledgerRepository: ledgerRepo,
    });
  }

  public async getCustomerWallet(customerId: string, currency = 'IRR') {
    let wallet = (await this.walletService.getWalletsByOwnerId(customerId))[0];
    if (!wallet) {
      const created = await this.walletService.createWallet(customerId, currency);
      wallet = created.wallet;
    }
    const balance = await this.walletService.getWalletBalance(wallet.id);
    return { wallet, balance };
  }

  public async topUpWallet(
    walletId: string,
    amountMinor: bigint,
    currency: string,
    reference: string,
    idempotencyKey: string,
  ) {
    const amount = Money.fromMinor(amountMinor, currency);
    return this.walletService.topUpWallet({
      walletId,
      amount,
      reference,
      idempotencyKey,
    });
  }

  public async adminCreditWallet(
    walletId: string,
    amountMinor: bigint,
    currency: string,
    reason: string,
    adminId: string,
    idempotencyKey: string,
  ) {
    const amount = Money.fromMinor(amountMinor, currency);
    return this.walletService.adminCreditWallet({
      walletId,
      amount,
      reason,
      adminId,
      idempotencyKey,
    });
  }

  public async adminDebitWallet(
    walletId: string,
    amountMinor: bigint,
    currency: string,
    reason: string,
    adminId: string,
    idempotencyKey: string,
  ) {
    const amount = Money.fromMinor(amountMinor, currency);
    return this.walletService.adminDebitWallet({
      walletId,
      amount,
      reason,
      adminId,
      idempotencyKey,
    });
  }

  public async debitForCheckout(
    walletId: string,
    amountMinor: bigint,
    currency: string,
    orderId: string,
    idempotencyKey: string,
  ) {
    const amount = Money.fromMinor(amountMinor, currency);
    return this.walletService.debitWalletForCheckout({
      walletId,
      amount,
      orderId,
      idempotencyKey,
    });
  }
}
```

### 2. Medusa Customer API Routes

- `GET /store/me/wallet`:
  - **Auth**: Authenticated Customer (`req.auth_context.actor_id`).
  - **Behavior**: Retrieves or provisions the authenticated customer's wallet and returns the current balance.
  - **Security**: Customer ID derived exclusively from verified session tokens, never client-supplied body parameters.

- `POST /store/me/wallet/topup`:
  - **Auth**: Authenticated Customer.
  - **Behavior**: Initiates an external gateway payment via `@amirhossein-moloki/payment-service`. _Does NOT credit the wallet immediately._
  - **Verification**: Credits the wallet **only** upon receiving an authoritative, server-verified payment result callback from the payment gateway via `walletService.topUpWallet()`.

### 3. Medusa Administrative API Routes

- `POST /admin/wallets/:id/credit`:
  - **Auth**: Authenticated Administrator (`req.auth_context.actor_id`).
  - **Body**: `{ amount: number, currency: string, reason: string, idempotencyKey: string }`.
  - **Validation**: Requires non-empty `reason`, valid `adminId`, strictly positive amount, and idempotency key.

- `POST /admin/wallets/:id/debit`:
  - **Auth**: Authenticated Administrator (`req.auth_context.actor_id`).
  - **Body**: `{ amount: number, currency: string, reason: string, idempotencyKey: string }`.
  - **Validation**: Requires non-empty `reason`, valid `adminId`, strictly positive amount, idempotency key, and checks for sufficient wallet balance.

### 4. Checkout & Payment Provider Integration Contract

To enable wallet payments during checkout in Medusa v2:

- Implement a Medusa `AbstractPaymentProvider` adapter (`pp_wallet`):
  - `initiatePayment()`: Checks customer wallet balance via `walletService.getWalletBalance()`.
  - `authorizePayment()`: Executes `walletService.debitWalletForCheckout()` with the order ID and idempotency key.
  - `capturePayment()`: Idempotently confirms payment (since debit was posted during authorization).
  - `cancelPayment()` / `refundPayment()`: Creates a compensating ledger transaction if order cancellation or refund is authorized.
- **Mixed Payment Limitation**: If order total exceeds wallet balance, mixed payment (partial wallet + external gateway) requires explicit Medusa Payment Collection splitting. Partial wallet debits should only occur if the external gateway authorization succeeds to maintain cross-system consistency.
