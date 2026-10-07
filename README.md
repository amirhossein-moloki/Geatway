# Payment Platform Ecosystem

Professional, modular, provider-agnostic multi-gateway payment orchestration platform built with Node.js, pnpm workspaces, and TypeScript (Strict Mode).

## Project Goal

The Payment Platform ecosystem is designed to standardise payment processing across Iranian (Mellat, Zarinpal, Zibal, Saman, etc.) and international payment gateways.

---

## Source of Truth & Package Distribution

The repository uses a single source of truth commercial release model:

- **Source of Truth:** GitHub Private Repository
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

| Package Name                                       | Purpose                                                                                   |
| :------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `@amirhossein-moloki/payment-core`                 | Core domain entities, gateway contracts, capability interfaces, and GatewayRegistry.      |
| `@amirhossein-moloki/payment-service`              | Application integration service, retry/timeout policies, idempotency, and test utilities. |
| `@amirhossein-moloki/payment-persistence-postgres` | PostgreSQL persistence repositories and schema migrations.                                |
| `@amirhossein-moloki/payment-mellat`               | Mellat (Behpardazht) PSP gateway integration.                                             |
| `@amirhossein-moloki/payment-zibal`                | Zibal IPG gateway integration.                                                            |
| `@amirhossein-moloki/payment-zarinpal`             | Zarinpal GraphQL v4 gateway integration.                                                  |
| `@amirhossein-moloki/payment-saman`                | Saman (SEP) gateway integration.                                                          |

---

## Consumer Package Installation

Consumers configure their project's `.npmrc` to authenticate with GitHub Packages (see `.npmrc.example`):

```ini
@amirhossein-moloki:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Installation Command

```bash
# Install core and required provider packages only
npm install @amirhossein-moloki/payment-core @amirhossein-moloki/payment-service @amirhossein-moloki/payment-mellat
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

- [AI Integration Guide (`AI-INTEGRATION.md`)](./AI-INTEGRATION.md) — Single source of truth for AI agents integrating payment packages into consumer applications.
- [Release & Commercial Distribution Guide (`docs/release-and-distribution.md`)](./docs/release-and-distribution.md) — Maintainer guide for release management, semver versioning, GitHub Packages publishing, and secrets safety.
