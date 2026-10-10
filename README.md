# Payment, SMS & Wallet Platform Ecosystem

Professional, modular, provider-agnostic multi-gateway payment orchestration, SMS panel platform, and stored-value wallet ledger system built with Node.js, pnpm workspaces, and TypeScript (Strict Mode).

## Project Goal

The monorepo contains three primary capability-driven platform ecosystems:

1. **Payment Platform Ecosystem:** Standardizes payment processing across Iranian (Mellat, Zarinpal, Zibal, Saman, etc.) and international payment gateways.
2. **SMS Platform Ecosystem:** Standardizes SMS sending, pattern/OTP dispatch, balance queries, line retrieval, and inbox message receiving across Iranian SMS panels (Melipayamak, SMS.ir).
3. **Wallet Platform Ecosystem:** Framework-agnostic double-entry financial ledger, exact minor-unit monetary math (`bigint`), PostgreSQL persistent storage, and Medusa v2 integration adapters (`pp_wallet`).

---

## Source of Truth & Package Distribution

The repository uses a single source of truth commercial release model:

- **Source of Truth:** GitHub Repository
- **Package Distribution:** GitHub Packages (`https://npm.pkg.github.com`)

```text
GitHub Private Repository (Source of Truth)
        │
        │ Validated source + Release Tag (e.g. v1.0.0)
        ▼
   CI/CD Pipeline (GitHub Actions)
        │
        └──────────────► GitHub Packages
```

---

## Monorepo Packages

All packages belong to the `@amirhossein-moloki` scope and can be independently versioned and installed:

### Payment Packages

| Package Name                                       | Purpose                                                                                   |
| :------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `@amirhossein-moloki/payment-core`                 | Core domain entities, gateway contracts, capability interfaces, and GatewayRegistry.      |
| `@amirhossein-moloki/payment-service`              | Application integration service, retry/timeout policies, idempotency, and test utilities. |
| `@amirhossein-moloki/payment-persistence-postgres` | PostgreSQL persistence repositories and schema migrations.                                |
| `@amirhossein-moloki/payment-mellat`               | Mellat (Behpardazht) PSP gateway integration.                                             |
| `@amirhossein-moloki/payment-zibal`                | Zibal IPG gateway integration.                                                            |
| `@amirhossein-moloki/payment-zarinpal`             | Zarinpal GraphQL v4 gateway integration.                                                  |
| `@amirhossein-moloki/payment-saman`                | Saman (SEP) gateway integration.                                                          |

### SMS Packages

| Package Name                          | Purpose                                                                            |
| :------------------------------------ | :--------------------------------------------------------------------------------- |
| `@amirhossein-moloki/sms-core`        | Core domain entities, provider contracts, capability interfaces, and `SmsService`. |
| `@amirhossein-moloki/sms-melipayamak` | Melipayamak SMS Panel provider integration.                                        |
| `@amirhossein-moloki/sms-smsir`       | SMS.ir Panel V2 provider integration.                                              |

### Wallet Packages

| Package Name                                      | Purpose                                                                                                                                 |
| :------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `@amirhossein-moloki/wallet-core`                 | Wallet aggregate, exact monetary math (`bigint`), double-entry ledger, `WalletService`, and Medusa v2 adapters (`pp_wallet`).           |
| `@amirhossein-moloki/wallet-persistence-postgres` | PostgreSQL persistence repositories, deterministic locking, exact `BIGINT` balance updates, and schema migrations (`DatabaseMigrator`). |

---

## Consumer Package Installation

Consumers configure their project's `.npmrc` to authenticate with GitHub Packages (see `.npmrc.example`):

```ini
@amirhossein-moloki:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Installation Commands

```bash
# Payment platform packages
pnpm add @amirhossein-moloki/payment-core @amirhossein-moloki/payment-service @amirhossein-moloki/payment-mellat

# SMS platform packages
pnpm add @amirhossein-moloki/sms-core @amirhossein-moloki/sms-melipayamak @amirhossein-moloki/sms-smsir

# Wallet platform packages
pnpm add @amirhossein-moloki/wallet-core @amirhossein-moloki/wallet-persistence-postgres pg
```

---

## Getting Started (Workspace Maintainers)

### Prerequisites

- Node.js >= 18
- pnpm >= 9

### Maintenance Commands

```bash
# Install workspace dependencies
pnpm install

# Build all workspace packages
pnpm build

# Run workspace unit test suite
pnpm test

# Run ESLint across workspace
pnpm lint

# Check code formatting
pnpm run format:check

# Validate package packing & clean external consumer installation
python3 scripts/validate-consumer-packages.py
```

---

## Documentation

### Payment Ecosystem

- [Payment AI Integration Guide (`AI-INTEGRATION.md`)](./AI-INTEGRATION.md) — Single source of truth for AI agents integrating payment packages.
- [Payment Architecture (`docs/payment-architecture.md`)](./docs/payment-architecture.md) — Architectural principles and state machine.
- [Payment Integration Guide (`docs/payment-integration-guide.md`)](./docs/payment-integration-guide.md) — Step-by-step developer integration guide.
- [Payment Provider Capabilities (`docs/provider-capabilities.md`)](./docs/provider-capabilities.md) — Gateway matrix and configuration schemas.
- [Release & Commercial Distribution Guide (`docs/release-and-distribution.md`)](./docs/release-and-distribution.md) — Maintainer guide for releases.

### SMS Ecosystem

- [SMS AI Integration Guide (`SMS-AI-INTEGRATION.md`)](./SMS-AI-INTEGRATION.md) — Authoritative single source of truth for AI agents integrating SMS packages.
- [SMS Architecture (`docs/sms-architecture.md`)](./docs/sms-architecture.md) — Component responsibilities, layer isolation, and capability matrix.
- [SMS Integration Guide (`docs/sms-integration-guide.md`)](./docs/sms-integration-guide.md) — Comprehensive developer guide for SMS setup and usage.
- [SMS Testing Strategy (`docs/sms-testing.md`)](./docs/sms-testing.md) — Unit testing patterns and mock provider implementation.

### Wallet Ecosystem

- [Wallet AI Implementation Guide (`docs/AI_IMPLEMENTATION_GUIDE.md`)](./docs/AI_IMPLEMENTATION_GUIDE.md) / [`AI-WALLET-INTEGRATION.md`](./AI-WALLET-INTEGRATION.md) — Single source of truth for AI coding agents integrating the wallet into `depix-ecommerce`.
- [Wallet Architecture (`docs/wallet-architecture.md`)](./docs/wallet-architecture.md) — Double-entry ledger design, state machines, row locking, and Medusa v2 adapters.
- [Wallet Integration Guide (`docs/wallet-integration-guide.md`)](./docs/wallet-integration-guide.md) — Developer setup, API usage examples, PostgreSQL schema, and Medusa v2 integration.
- [Wallet Testing Strategy (`docs/wallet-testing.md`)](./docs/wallet-testing.md) — Test suites, vitest coverage, and distinction between `pg-mem` emulator and real PostgreSQL.
- [Wallet Troubleshooting Guide (`docs/wallet-troubleshooting.md`)](./docs/wallet-troubleshooting.md) — Evidence-based diagnostic steps for common balance, idempotency, and concurrency errors.
