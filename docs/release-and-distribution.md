# Release, Versioning & Commercial Package Distribution Guide

This document details the commercial package distribution model, versioning strategy, CI/CD automated release pipeline, and maintainer/consumer operational procedures for the Payment Platform ecosystem.

---

## 1. Source of Truth & Architecture Model

The ecosystem follows a single source of truth distribution model:

```text
GitHub Private Repository (Source of Truth)
        │
        │ Validated source code + Git Release Tag (e.g. v1.0.0)
        ▼
   CI/CD Pipeline (GitHub Actions)
        │
        ├──────────────► npm Private Registry (https://registry.npmjs.org/)
        │
        └──────────────► GitHub Packages (https://npm.pkg.github.com)
```

### Key Principles

1. **GitHub Repository as Single Source of Truth:** Code changes, features, and version tags originate solely from the private GitHub source repository.
2. **Dual-Registry Distribution:** Validated release builds are published simultaneously to both **npm Private Registry** and **GitHub Packages**.
3. **No Code Forks:** The same published package build artifact (tarball) is distributed to both registries without maintaining separate source trees or provider-specific forks.
4. **Independent Package Granularity:** Consumers install only the scoped packages they are entitled or required to use (e.g. `@company/payment-core`, `@company/payment-service`, `@company/payment-mellat`).

---

## 2. Package Scope & Distribution Architecture

All packages belong to the `@company` scope and are configured as private (`"publishConfig": { "access": "restricted" }`):

| Package Name                            | Distributable Target | Description                                                                                             |
| :-------------------------------------- | :------------------- | :------------------------------------------------------------------------------------------------------ |
| `@company/payment-core`                 | Standard Library     | Provider-agnostic domain entities, gateway contracts, registry, and standard errors.                    |
| `@company/payment-service`              | Standard Library     | Higher-level application service, retry/timeout policies, idempotency orchestrator, and test utilities. |
| `@company/payment-persistence-postgres` | Adapter              | PostgreSQL persistence repositories and SQL schema migrations.                                          |
| `@company/payment-mellat`               | PSP Provider         | Mellat (Behpardazht) payment gateway provider implementation.                                           |
| `@company/payment-zibal`                | IPG Provider         | Zibal payment gateway provider implementation.                                                          |
| `@company/payment-zarinpal`             | IPG Provider         | Zarinpal GraphQL v4 payment gateway provider implementation.                                            |
| `@company/payment-saman`                | PSP Provider         | Saman (SEP) payment gateway provider implementation.                                                    |

---

## 3. Registry Configuration for Consumers

Consumers can choose either **npm Private Registry** or **GitHub Packages** as their distribution channel.

### Safe Template (`.npmrc.example`)

A sample template is provided at root `.npmrc.example`:

```ini
# .npmrc.example - Registry Configuration Template

# Option A: npm Private Registry
# @company:registry=https://registry.npmjs.org/
# //registry.npmjs.org/:_authToken=${NPM_TOKEN}

# Option B: GitHub Packages
@company:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}

# Default Registry for public dependencies
registry=https://registry.npmjs.org/
```

> **SECURITY WARNING:** Never commit an `.npmrc` file containing raw access tokens to version control. Use environment variable expansion (`${NPM_TOKEN}` or `${GITHUB_TOKEN}`) or store tokens in local developer user configs (`~/.npmrc`).

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

## 5. Automated CI/CD Release Pipeline

Package validation and dual-registry publishing are automated via GitHub Actions workflows:

### CI Workflow (`.github/workflows/ci.yml`)

- **Triggers:** Pull Requests and pushes to `main`.
- **Actions:** Matrix testing (Node 18.x & 20.x), code format checks (`pnpm format:check`), ESLint (`pnpm lint`), TypeScript build (`pnpm build`), unit test suites (`pnpm test`), and external consumer package installation simulation (`python3 scripts/validate-consumer-packages.py`).
- **Safety:** Pull Requests NEVER publish packages.

### Release Workflow (`.github/workflows/release.yml`)

- **Triggers:** Git tag push matching `v*` (e.g. `v1.0.0`) or manual `workflow_dispatch`.
- **Publishing Steps:**
  1. Full validation suite execution.
  2. Tarball verification & workspace protocol resolution audit.
  3. Publish to **npm Private Registry** using `NPM_TOKEN`.
  4. Publish to **GitHub Packages** using `GITHUB_TOKEN`.
  5. Post-publish cleanup of authentication tokens.

---

## 6. Secrets Management & Security

- **`NPM_TOKEN`**: Granular automation token for the `@company` scope on npmjs.com.
- **`GITHUB_TOKEN`**: Standard GitHub Actions secret with `packages: write` permissions for GitHub Packages.
- **Log Sanitization:** Publishing scripts do not print complete environment variables or authentication tokens.
- **Tarball Audit:** Pre-pack audits verify that sensitive files (`.env`, `.log`, private keys, internal uncompiled `src/`, or test fixtures) are excluded from published package artifacts.

---

## 7. Rollback & Failed Release Procedures

npm and GitHub Packages enforce package immutability; published versions cannot be silently overwritten or modified.

### Failed Publish Handling

1. **Partial Registry Success (Dual-Registry Desync):**
   - If publishing succeeds on npm Private but fails on GitHub Packages (e.g. network timeout):
   - Do NOT unpublish or alter the published npm version.
   - Re-run the GitHub Packages publish step using `workflow_dispatch` or fix the network condition and push a patch release tag (e.g., `v1.0.1`).

2. **Defective Release Version:**
   - If a published package contains a critical defect or security vulnerability:
   - Deprecate the affected version using `npm deprecate @company/payment-package@1.0.0 "Defective build - upgrade to 1.0.1"`.
   - Immediately publish a corrected patch version (e.g., `1.0.1`).

---

## 8. Release Verification Matrix

Before completing a release, all matrix criteria must be verified:

| Check Item                            | npm Private Registry | GitHub Packages | Verification Command / Script                                  |
| :------------------------------------ | :------------------: | :-------------: | :------------------------------------------------------------- |
| **Authentication**                    |       Verified       |    Verified     | GitHub Actions Secret Injection (`NPM_TOKEN` / `GITHUB_TOKEN`) |
| **Package Tarball Integrity**         |       Verified       |    Verified     | `python3 scripts/validate-consumer-packages.py`                |
| **Workspace Protocol Conversion**     |       Verified       |    Verified     | Pre-pack audit verifies `workspace:*` -> `1.0.0`               |
| **Package Exports Resolution**        |       Verified       |    Verified     | TypeScript compiler check in external consumer app             |
| **TypeScript Declarations (`.d.ts`)** |       Verified       |    Verified     | `dist/index.d.ts` verified in unpacked tarballs                |
| **Private Access Controls**           |       Verified       |    Verified     | `"publishConfig": { "access": "restricted" }`                  |
| **External Consumer Installation**    |       Verified       |    Verified     | Clean `npm install` and Node execution test                    |
