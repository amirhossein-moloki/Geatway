# Payment, SMS & Wallet Platform Ecosystem

A professional, modular, provider-agnostic monorepo ecosystem containing standard payment orchestration, SMS panel integration, and double-entry stored-value wallet ledger platforms built with Node.js, pnpm workspaces, TypeScript (Strict Mode), and PostgreSQL.

## 1. Project Overview

This repository is structured as a pnpm monorepo hosting three core platform ecosystems designed for production applications:

1. **Payment Platform Ecosystem:** Standardizes payment processing across Iranian payment service providers (Behpardazht Mellat, Zibal IPG, Zarinpal GraphQL v4, Saman SEP) and custom payment gateways using a uniform state machine, registry pattern, retry/circuit-breaker policies, and PostgreSQL idempotency & transaction storage.
2. **SMS Platform Ecosystem:** Standardizes SMS pattern/OTP dispatching, bulk message sending, line retrieval, balance querying, and inbox message retrieval across Iranian SMS service panels (Melipayamak, SMS.ir Panel V2).
3. **Wallet Platform Ecosystem:** Framework-agnostic double-entry financial ledger and stored-value wallet system built with exact integer monetary arithmetic (`bigint`), deterministic row locking (`SELECT FOR UPDATE`), read-only reconciliation services, and Medusa v2 checkout integration adapters (`pp_wallet`).

---

## 2. Monorepo Packages

All workspace packages belong to the `@amirhossein-moloki` scope and can be independently built, tested, and published to GitHub Packages.

### Payment Ecosystem

| Package Name                                       | Purpose                                                                                                                                                   |
| :------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@amirhossein-moloki/payment-core`                 | Core domain entities (`Payment`, `Transaction`), interfaces (`IPaymentGateway`), gateway registry (`GatewayRegistry`), and standard error types.          |
| `@amirhossein-moloki/payment-service`              | `PaymentApplicationService`, retry/timeout policies, circuit breaker, idempotency management, and in-memory test mocks.                                   |
| `@amirhossein-moloki/payment-persistence-postgres` | PostgreSQL persistence repositories (`PostgresPaymentRepository`, `PostgresTransactionRepository`, `PostgresIdempotencyRepository`, etc.) and migrations. |
| `@amirhossein-moloki/payment-mellat`               | Mellat (Behpardazht) PSP gateway integration using SOAP/WSDL contracts.                                                                                   |
| `@amirhossein-moloki/payment-zibal`                | Zibal IPG gateway integration using REST/JSON endpoints.                                                                                                  |
| `@amirhossein-moloki/payment-zarinpal`             | Zarinpal gateway integration using GraphQL v4.                                                                                                            |
| `@amirhossein-moloki/payment-saman`                | Saman (SEP) IPG gateway integration.                                                                                                                      |

### SMS Ecosystem

| Package Name                          | Purpose                                                                                                            |
| :------------------------------------ | :----------------------------------------------------------------------------------------------------------------- |
| `@amirhossein-moloki/sms-core`        | Core domain entities (`SmsMessage`), provider interface (`ISmsProvider`), `SmsProviderRegistry`, and `SmsService`. |
| `@amirhossein-moloki/sms-melipayamak` | Melipayamak SMS Panel provider integration supporting REST and SOAP endpoints.                                     |
| `@amirhossein-moloki/sms-smsir`       | SMS.ir Panel V2 provider integration supporting REST API v2.                                                       |

### Wallet Ecosystem

| Package Name                                      | Purpose                                                                                                                                                                                      |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@amirhossein-moloki/wallet-core`                 | Stored-value wallet domain, exact `bigint` monetary math (`Money`), double-entry ledger engine, `WalletService`, `WalletReconciliationService`, and Medusa v2 payment adapter (`pp_wallet`). |
| `@amirhossein-moloki/wallet-persistence-postgres` | PostgreSQL persistence repositories (`PostgresWalletRepository`, `PostgresLedgerRepository`, `PostgresReconciliationRepository`), schema migrations, and row locking.                        |

---

## 3. Technology Stack

- **Runtime Environment:** Node.js (>= 18.0.0)
- **Package Manager:** pnpm (>= 9.0.0) with pnpm workspaces
- **Language:** TypeScript (Strict Mode, NodeNext ES Module Resolution)
- **Database Persistence:** PostgreSQL (`pg` driver, raw SQL queries, parameterized transactions, schema migrations)
- **Test Framework:** Vitest (with `pg-mem` fallback for unit tests and real PostgreSQL for integration/concurrency tests)
- **Linting & Formatting:** ESLint 8 (`@typescript-eslint`), Prettier

---

## 4. Workspace Directory Structure

```text
payment-platform-monorepo/
├── docs/                         # Ecosystem architecture, integration, testing, & troubleshooting guides
├── examples/                     # Integration examples & test harnesses
│   ├── basic-mellat/             # Basic Mellat PSP usage example
│   ├── basic-saman/              # Basic Saman SEP usage example
│   ├── basic-zarinpal/           # Basic Zarinpal GraphQL v4 usage example
│   ├── basic-zibal/              # Basic Zibal IPG usage example
│   ├── depix-test/               # Medusa v2 wallet integration test harness
│   ├── payment-integration/      # End-to-end payment service example
│   └── sms-integration/          # End-to-end SMS service example
├── packages/                     # Core workspace packages (@amirhossein-moloki/*)
│   ├── payment-core/
│   ├── payment-mellat/
│   ├── payment-persistence-postgres/
│   ├── payment-saman/
│   ├── payment-service/
│   ├── payment-zarinpal/
│   ├── payment-zibal/
│   ├── sms-core/
│   ├── sms-melipayamak/
│   ├── sms-smsir/
│   ├── wallet-core/
│   └── wallet-persistence-postgres/
├── scripts/                      # Maintainer scripts (e.g. consumer package validation)
│   └── validate-consumer-packages.py
├── .env.example                  # Production/Default environment template
├── .env.sandbox.example          # Sandbox test environment template
├── package.json                  # Root monorepo workspace configuration
├── pnpm-workspace.yaml           # pnpm workspace definition
└── tsconfig.json                 # Shared base TypeScript configuration
```

---

## 5. Prerequisites

- **Node.js:** `>= 18.0.0`
- **pnpm:** `>= 9.0.0`
- **PostgreSQL:** Required for running persistence-backed integration tests or production persistence adapters. _(Unit tests run in-memory using `pg-mem` if no PostgreSQL connection is configured)._

---

## 6. Installation & Workspace Setup

### Maintainer Workspace Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/amirhossein-moloki/Geatway.git
   cd Geatway
   pnpm install
   ```

2. Build all packages in the workspace:

   ```bash
   pnpm build
   ```

3. Run the unit & integration test suite:
   ```bash
   pnpm test
   ```

### External Consumer Setup (GitHub Packages)

Packages are distributed via GitHub Packages (`npm.pkg.github.com`). Consumers configure their project's `.npmrc` file as follows:

```ini
@amirhossein-moloki:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install the desired packages:

```bash
# Payment platform packages
pnpm add @amirhossein-moloki/payment-core @amirhossein-moloki/payment-service @amirhossein-moloki/payment-mellat

# SMS platform packages
pnpm add @amirhossein-moloki/sms-core @amirhossein-moloki/sms-melipayamak @amirhossein-moloki/sms-smsir

# Wallet platform packages
pnpm add @amirhossein-moloki/wallet-core @amirhossein-moloki/wallet-persistence-postgres pg
```

---

## 7. Environment Configuration

Copy `.env.example` to `.env` for local setup or `.env.sandbox.example` when running sandbox provider integration tests.

### General & Database Variables

| Variable Name       | Description                                                    | Required / Default                       |
| :------------------ | :------------------------------------------------------------- | :--------------------------------------- |
| `PAYMENT_ENV`       | Execution environment mode (`production` or `sandbox`).        | Optional (Default: `production`)         |
| `RUN_SANDBOX_TESTS` | Enables live sandbox gateway tests when set to `true`.         | Optional (Default: `false`)              |
| `DATABASE_URL`      | PostgreSQL database connection string for persistence modules. | Optional for unit tests, required for DB |

### Payment Provider Credentials (`.env.example`)

| Variable Name           | Description                                                    |
| :---------------------- | :------------------------------------------------------------- |
| `MELLAT_TERMINAL_ID`    | Terminal ID for Behpardazht Mellat PSP.                        |
| `MELLAT_USERNAME`       | Username for Behpardazht Mellat PSP.                           |
| `MELLAT_PASSWORD`       | Password for Behpardazht Mellat PSP.                           |
| `MELLAT_CALLBACK_URL`   | Merchant callback URL for Behpardazht Mellat payments.         |
| `ZIBAL_MERCHANT`        | Merchant key for Zibal IPG (use `zibal` for test environment). |
| `ZIBAL_CALLBACK_URL`    | Callback URL for Zibal transactions.                           |
| `ZARINPAL_ACCESS_TOKEN` | OAuth access token for Zarinpal GraphQL v4 API.                |
| `ZARINPAL_MERCHANT_ID`  | Merchant ID for Zarinpal payment gateway.                      |
| `ZARINPAL_CALLBACK_URL` | Redirect URL after Zarinpal checkout.                          |
| `SAMAN_TERMINAL_ID`     | Terminal ID for Saman Electronic Payment (SEP).                |
| `SAMAN_REDIRECT_URL`    | Callback URL for Saman SEP payment completion.                 |

---

## 8. Available Scripts

All standard maintenance commands are defined in the root `package.json`:

```bash
# Build all packages across the workspace recursively using TypeScript compiler (tsc)
pnpm build

# Run unit and integration tests across all workspace packages via Vitest
pnpm test

# Run tests with sandbox integration tests enabled
pnpm test:sandbox

# Run ESLint checks across all workspace packages
pnpm lint

# Automatically fix ESLint warnings and errors across packages
pnpm lint:fix

# Check formatting across the entire monorepo using Prettier
pnpm run format:check

# Format files across the monorepo using Prettier
pnpm run format

# Execute the external consumer package packing and build validation script
python3 scripts/validate-consumer-packages.py
```

---

## 9. Monorepo Capabilities & API Usage

### Payment Gateway Orchestration (`@amirhossein-moloki/payment-service`)

Registers multiple payment gateways, manages transaction state transitions, and enforces idempotency and retry policies:

```typescript
import { GatewayRegistry } from '@amirhossein-moloki/payment-core';
import { MellatGateway } from '@amirhossein-moloki/payment-mellat';
import { ZibalGateway } from '@amirhossein-moloki/payment-zibal';
import {
  PaymentApplicationService,
  InMemoryPaymentRepository,
  InMemoryTransactionRepository,
} from '@amirhossein-moloki/payment-service';

const registry = new GatewayRegistry();
registry.register(
  new MellatGateway({
    terminalId: '...',
    userName: '...',
    userPassword: '...',
    callbackUrl: '...',
  }),
);
registry.register(new ZibalGateway({ merchant: 'zibal', callbackUrl: '...' }));

const service = new PaymentApplicationService({
  registry,
  paymentRepository: new InMemoryPaymentRepository(),
  transactionRepository: new InMemoryTransactionRepository(),
});
```

### SMS Service (`@amirhossein-moloki/sms-core`)

Dispatches transactional messages and OTP patterns through registered SMS panels:

```typescript
import { SmsProviderRegistry, SmsService } from '@amirhossein-moloki/sms-core';
import { MelipayamakProvider } from '@amirhossein-moloki/sms-melipayamak';
import { SmsirProvider } from '@amirhossein-moloki/sms-smsir';

const registry = new SmsProviderRegistry();
registry.register(new MelipayamakProvider({ username: '...', password: '...' }));
registry.register(new SmsirProvider({ apiKey: '...' }));

const smsService = new SmsService(registry);
await smsService.sendPattern('smsir', {
  to: '09120000000',
  patternId: 100000,
  parameters: { code: '123456' },
});
```

### Double-Entry Wallet Ledger (`@amirhossein-moloki/wallet-core`)

Performs exact minor-unit monetary operations and manages wallet balances backed by double-entry ledger entries:

```typescript
import { WalletService, Money } from '@amirhossein-moloki/wallet-core';

// Initialize WalletService with PostgreSQL or in-memory repositories
const wallet = await walletService.createWallet({ ownerId: 'usr_123', currency: 'IRR' });

// Deposit funds via double-entry ledger posting
await walletService.topUp({
  walletId: wallet.id,
  amount: Money.fromMajor(100000, 'IRR'), // Converts exact bigint IRR minor units
  referenceId: 'tx_topup_123',
});
```

---

## 10. Documentation Index

Detailed architectural and developer documentation is available in the [`docs/`](./docs) folder and dedicated root markdown files:

### Payment Ecosystem

- [Payment AI Integration Guide (`AI-INTEGRATION.md`)](./AI-INTEGRATION.md) — Authoritative AI agent guide for payment integration.
- [Payment Architecture (`docs/payment-architecture.md`)](./docs/payment-architecture.md) — Architectural design, gateway state machine, and resilience patterns.
- [Payment Integration Guide (`docs/payment-integration-guide.md`)](./docs/payment-integration-guide.md) — Developer guide for payment gateway setup and API usage.
- [Provider Capabilities Matrix (`docs/provider-capabilities.md`)](./docs/provider-capabilities.md) — Gateway capability matrix and schema configuration options.
- [Payment Testing Strategy (`docs/payment-testing.md`)](./docs/payment-testing.md) — Unit testing and mock gateway patterns.
- [Payment Troubleshooting Guide (`docs/payment-troubleshooting.md`)](./docs/payment-troubleshooting.md) — Common error resolution steps.

### SMS Ecosystem

- [SMS AI Integration Guide (`SMS-AI-INTEGRATION.md`)](./SMS-AI-INTEGRATION.md) — Single source of truth for AI agent integration with SMS packages.
- [SMS Architecture (`docs/sms-architecture.md`)](./docs/sms-architecture.md) — Layer isolation, provider registry, and message flow.
- [SMS Integration Guide (`docs/sms-integration-guide.md`)](./docs/sms-integration-guide.md) — Guide for pattern dispatch, bulk messages, and provider setup.
- [SMS Testing Strategy (`docs/sms-testing.md`)](./docs/sms-testing.md) — Test setup and mock SMS provider details.

### Wallet Ecosystem

- [Wallet AI Implementation Guide (`docs/AI_IMPLEMENTATION_GUIDE.md`)](./docs/AI_IMPLEMENTATION_GUIDE.md) / [`AI-WALLET-INTEGRATION.md`](./AI-WALLET-INTEGRATION.md) — Guide for AI agents integrating wallet operations.
- [Wallet Architecture (`docs/wallet-architecture.md`)](./docs/wallet-architecture.md) — Double-entry ledger architecture, row locking strategy, and state machines.
- [Wallet Integration Guide (`docs/wallet-integration-guide.md`)](./docs/wallet-integration-guide.md) — Guide for wallet operations, PostgreSQL schema, and Medusa v2 adapter.
- [Wallet Testing Strategy (`docs/wallet-testing.md`)](./docs/wallet-testing.md) — Double-entry balance tests and concurrency verification.
- [Wallet Troubleshooting Guide (`docs/wallet-troubleshooting.md`)](./docs/wallet-troubleshooting.md) — Ledger reconciliation and concurrency issue diagnostic guide.

### Release & Distribution

- [Release and Distribution Guide (`docs/release-and-distribution.md`)](./docs/release-and-distribution.md) — Commercial distribution workflow via GitHub Packages.
