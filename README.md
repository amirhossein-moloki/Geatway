# Payment Platform Ecosystem

Professional, modular, provider-agnostic multi-gateway payment orchestration platform built with Node.js, pnpm workspaces, and TypeScript (Strict Mode).

## Project Goal

The Payment Platform ecosystem is designed to standardise payment processing across Iranian (Mellat, Zarinpal, Zibal, Saman, etc.) and international (Stripe, PayPal, Adyen, etc.) payment gateways.

## Architecture & Monorepo Structure

```text
payment-platform/
├── packages/
│   └── payment-core/        # Provider-agnostic domain models, gateway contracts, & registry
├── examples/
│   └── basic-usage.ts       # Example showing Core + Registry usage
├── docs/
│   └── architecture.md      # Detailed architectural specification
├── package.json             # Workspace root config
├── pnpm-workspace.yaml      # Monorepo workspace configuration
├── tsconfig.json            # Base strict TypeScript config
├── eslint.config.js         # Workspace ESLint rules
└── prettier.config.js       # Workspace formatting config
```

### Dependency Direction Rules

1. **Core is Independent**: `@company/payment-core` does NOT depend on any payment provider or framework.
2. **Providers depend on Core**: Future provider packages (e.g. `@company/payment-mellat`) will import contracts and domain interfaces from `@company/payment-core`.
3. **Explicit Registration**: Core does not hardcode provider packages. Providers register explicitly via `GatewayRegistry`.

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Installation & Commands

```bash
# Install workspace dependencies
pnpm install

# Build all packages
pnpm build

# Run unit test suite across workspace
pnpm test

# Run ESLint across workspace
pnpm lint

# Check code formatting
pnpm run format:check
```

## Future Architecture Roadmap (Phase 2+)

```text
packages/
├── payment-core/
├── payment-mellat/      # Phase 2
├── payment-zarinpal/    # Phase 3
├── payment-zibal/
├── payment-stripe/
└── ...
```
