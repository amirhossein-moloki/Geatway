# Payment Integration Reference Application

This reference application demonstrates how to integrate `@amirhossein-moloki/payment-core`, `@company/payment-service`, and gateway provider packages (`@company/payment-mellat`, `@company/payment-zibal`, `@company/payment-zarinpal`, `@company/payment-saman`) into a backend service.

---

## 1. Requirements

- Node.js >= 18.0.0
- pnpm >= 8.0.0

---

## 2. Environment Setup

Copy `.env.example` to `.env` and fill in your gateway credentials:

```bash
cp .env.example .env
```

---

## 3. Running & Building

To build the TypeScript project:

```bash
pnpm build
```

To run the integration test suite:

```bash
pnpm test
```

---

## 4. Endpoints & OpenAPI Contract

See `openapi.yml` in this directory for the full REST API specification.

Exposed routes demonstrated:

- `POST /api/v1/payments` — Create payment session
- `GET /api/v1/payments/:id` — Get payment details
- `POST /api/v1/payments/callback/:gateway` — Process gateway bank callback
- `POST /api/v1/payments/:id/verify` — Verify payment
- `POST /api/v1/payments/:id/inquiry` — Inquire payment remotely
- `POST /api/v1/payments/:id/refund` — Refund payment
