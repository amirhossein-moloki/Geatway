# Release, Versioning & Commercial Package Distribution Guide

This document details the commercial package distribution model, versioning strategy, CI/CD automated release pipeline, and maintainer/consumer operational procedures for the Payment Platform ecosystem.

---

## 1. Source of Truth & Architecture Model

The ecosystem follows a single source of truth distribution model:

```text
GitHub Private Repository (Source of Truth)
        │
        │ Package Path Change or Specific Package Tag (e.g. payment-core-v1.0.1)
        ▼
   CI/CD Pipeline (Independent GitHub Actions Workflows)
        │
        └──────────────► GitHub Packages (https://npm.pkg.github.com)
```

### Key Principles

1. **GitHub Repository as Single Source of Truth:** Code changes, features, and version tags originate solely from the private GitHub source repository.
2. **GitHub Packages Distribution:** Validated release builds are published exclusively to **GitHub Packages**.
3. **No Code Forks:** The published package build artifact (tarball) is distributed without maintaining separate source trees or provider-specific forks.
4. **Independent Package Granularity:** Consumers install only the scoped packages they are entitled or required to use (e.g. `@amirhossein-moloki/payment-core`, `@amirhossein-moloki/payment-service`, `@amirhossein-moloki/payment-mellat`).
5. **Independent Package Publishing:** Each package is published completely independently. Changes or releases for one package do not trigger publish jobs for other packages.

---

## 2. Package Scope & Distribution Architecture

Packages belong to the `@amirhossein-moloki` scope and are configured as private (`"publishConfig": { "access": "restricted", "registry": "https://npm.pkg.github.com" }`):

| Package Name                            | Directory                               | Distributable Target | Description                                                                                             |
| :-------------------------------------- | :-------------------------------------- | :------------------- | :------------------------------------------------------------------------------------------------------ |
| `@amirhossein-moloki/payment-core`      | `packages/payment-core`                 | Standard Library     | Provider-agnostic domain entities, gateway contracts, registry, and standard errors.                    |
| `@amirhossein-moloki/payment-service`              | `packages/payment-service`              | Standard Library     | Higher-level application service, retry/timeout policies, idempotency orchestrator, and test utilities. |
| `@amirhossein-moloki/payment-persistence-postgres` | `packages/payment-persistence-postgres` | Adapter              | PostgreSQL persistence repositories and SQL schema migrations.                                          |
| `@amirhossein-moloki/payment-mellat`               | `packages/payment-mellat`               | PSP Provider         | Mellat (Behpardazht) payment gateway provider implementation.                                           |
| `@amirhossein-moloki/payment-zibal`                | `packages/payment-zibal`                | IPG Provider         | Zibal payment gateway provider implementation.                                                          |
| `@amirhossein-moloki/payment-zarinpal`             | `packages/payment-zarinpal`             | IPG Provider         | Zarinpal GraphQL v4 payment gateway provider implementation.                                            |
| `@amirhossein-moloki/payment-saman`                | `packages/payment-saman`                | PSP Provider         | Saman (SEP) payment gateway provider implementation.                                                    |

---

## 3. Registry Configuration for Consumers

Consumers configure their projects to use **GitHub Packages** as their distribution registry.

### Safe Template (`.npmrc.example`)

A sample template is provided at root `.npmrc.example`:

```ini
# .npmrc.example - GitHub Packages Registry Configuration Template

@amirhossein-moloki:registry=https://npm.pkg.github.com
@amirhossein-moloki:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

> **SECURITY WARNING:** Never commit an `.npmrc` file containing raw access tokens to version control. Use environment variable expansion (`${GITHUB_TOKEN}`) or store tokens in local developer user configs (`~/.npmrc`).

---

## 4. Independent Versioning Strategy

Ecosystem packages are independently versionable following Semantic Versioning (`MAJOR.MINOR.PATCH`):

- **`MAJOR`**: Breaking domain API changes or incompatible capability contract updates.
- **`MINOR`**: Backwards-compatible new gateway features or provider additions.
- **`PATCH`**: Backwards-compatible bug fixes or security updates.

### Inter-Package Dependency Rules

Workspace dependencies use `workspace:*` during internal monorepo development. Upon packaging (`pnpm pack` / `pnpm publish`), `workspace:*` is deterministically resolved to explicit semver versions (e.g., `"1.0.0"`).

Published packages **NEVER** contain monorepo relative path dependencies (such as `"../../packages/payment-core"`).

---

## 5. Automated Independent CI/CD Release Workflows

Package validation and publishing are automated via dedicated GitHub Actions workflows in `.github/workflows/`:

### 1. CI Workflow (`.github/workflows/ci.yml`)

- **Triggers:** Pull Requests and pushes to `main`.
- **Actions:** Matrix testing (Node 18.x & 20.x), code format checks (`pnpm format:check`), ESLint (`pnpm lint`), TypeScript build (`pnpm build`), unit test suites (`pnpm test`), and external consumer package installation simulation (`python3 scripts/validate-consumer-packages.py`).
- **Safety:** Pull Requests NEVER publish packages.

### 2. Dedicated Package Publishing Workflows

Each package has a dedicated publish workflow:

- `.github/workflows/publish-payment-core.yml`
- `.github/workflows/publish-payment-service.yml`
- `.github/workflows/publish-payment-persistence-postgres.yml`
- `.github/workflows/publish-payment-mellat.yml`
- `.github/workflows/publish-payment-zibal.yml`
- `.github/workflows/publish-payment-zarinpal.yml`
- `.github/workflows/publish-payment-saman.yml`

#### Workflow Triggering Principles:

1. **Path-Based Trigger (`paths`)**: Triggers on `push` to `main` when files under `packages/<package-dir>/**` are modified.
2. **Package-Specific Tags**: Triggers when package-specific tags are pushed (e.g., `payment-core-v1.0.1`, `@amirhossein-moloki/payment-core@1.0.1`, `packages/payment-core/v1.0.1`).
3. **Manual Trigger (`workflow_dispatch`)**: Allows manually triggering package releases.

#### Idempotency & Version Checking:

Before publishing, each workflow checks if the version in `package.json` is already published on GitHub Packages using `npm view <package-name>@<version> version --registry=https://npm.pkg.github.com`.
If the version already exists, the publish step is safely skipped (exit 0) to prevent duplicate publishing errors or breaking releases.

---

## 6. Secrets Management & Security

- **`GITHUB_TOKEN`**: Standard GitHub Actions secret with `packages: write` permissions for GitHub Packages (`NODE_AUTH_TOKEN: ${{ github.token }}`).
- **Log Sanitization:** Publishing scripts do not print complete environment variables or authentication tokens.
- **Tarball Audit:** Pre-pack audits verify that sensitive files (`.env`, `.log`, private keys, internal uncompiled `src/`, or test fixtures) are excluded from published package artifacts.

---

## 7. Rollback & Failed Release Procedures

GitHub Packages enforces package immutability; published versions cannot be silently overwritten or modified.

### Failed Publish Handling

1. **Failed Publish Step:**
   - If publishing fails on GitHub Packages (e.g. network timeout or missing permissions):
   - Re-run the package workflow using `workflow_dispatch` or bump the version and push a patch release tag (e.g., `payment-core-v1.0.1`).

2. **Defective Release Version:**
   - If a published package contains a critical defect or security vulnerability:
   - Immediately publish a corrected patch version for that specific package (e.g., `1.0.1`).

---

## 8. Release Verification Matrix

Before completing a release, all matrix criteria must be verified:

| Check Item                            | GitHub Packages | Verification Command / Script                    |
| :------------------------------------ | :-------------: | :----------------------------------------------- |
| **Authentication**                    |    Verified     | GitHub Actions `GITHUB_TOKEN` Injection          |
| **Package Tarball Integrity**         |    Verified     | `python3 scripts/validate-consumer-packages.py`  |
| **Workspace Protocol Conversion**     |    Verified     | Pre-pack audit verifies `workspace:*` -> `1.0.0` |
| **Package Exports Resolution**        |    Verified     | TypeScript compiler check in external consumer   |
| **TypeScript Declarations (`.d.ts`)** |    Verified     | `dist/index.d.ts` verified in unpacked tarballs  |
| **Private Access Controls**           |    Verified     | `"publishConfig": { "access": "restricted" }`    |
| **External Consumer Installation**    |    Verified     | Clean `npm install` and Node execution test      |
