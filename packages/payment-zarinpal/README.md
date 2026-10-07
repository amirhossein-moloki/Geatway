# @amirhossein-moloki/payment-zarinpal

درگاه پرداخت زرین‌پال (GraphQL) برای اکوسیستم `@amirhossein-moloki/payment-core`.

## Source of Truth

پیاده‌سازی این پکیج کاملاً مستند بر اساس فایل `zarinpall.md` و معماری GraphQL نسخه 4 زرین‌پال انجام شده است.

## نصب

```bash
pnpm add @amirhossein-moloki/payment-zarinpal @amirhossein-moloki/payment-core
```

## نحوه استفاده

```ts
import { GatewayRegistry, Payment } from '@amirhossein-moloki/payment-core';
import { ZarinpalGateway } from '@amirhossein-moloki/payment-zarinpal';

const registry = new GatewayRegistry();

const zarinpalGateway = new ZarinpalGateway({
  accessToken: 'YOUR_ACCESS_TOKEN',
  merchantId: 'YOUR_MERCHANT_ID',
  callbackUrl: 'https://yourdomain.com/callback',
});

registry.register(zarinpalGateway);

// Create Payment
const payment = Payment.create({
  id: 'order-2002',
  amount: 200000, // Toman/Rial based on store policy
  currency: 'IRR',
  gatewayId: 'zarinpal',
  description: 'خرید اشتراک',
});

const result = await zarinpalGateway.createPayment({ payment });
console.log(result.redirectUrl);
```

## قابلیت‌ها (Capabilities)

- `CREATE_PAYMENT`
- `VERIFY`
- `CALLBACK`

## Sandbox / Test Environment

- **Sandbox Availability**: Unknown / Not Documented in GraphQL v4 specification (`zarinpall.md`).
- **Endpoint**: `https://next.zarinpal.com/api/v4/graphql` (Production endpoint).
- **Environment Selection**: Set `environment: "sandbox"` in `ZarinpalConfig`.
- **Required Configuration for Sandbox**: A custom test GraphQL endpoint (`baseUrl`) must be provided if testing in sandbox environment.
- **Production Safety**: Initializing with `environment: "sandbox"` without providing a custom `baseUrl` throws `ConfigurationError` to prevent sending test traffic to production GraphQL endpoint.
- **Supported Test Operations**: `PaymentRequest`, `PaymentVerification`, Callback parsing via `MockGateway` or mock HTTP transport.

## تست‌ها

```bash
pnpm --filter @amirhossein-moloki/payment-zarinpal test
```
