# @amirhossein-moloki/payment-zibal

درگاه پرداخت زیبال برای اکوسیستم `@amirhossein-moloki/payment-core`.

## Source of Truth

پیاده‌سازی این پکیج کاملاً مستند بر اساس فایل `ziball.json` انجام شده است.

## نصب

```bash
pnpm add @amirhossein-moloki/payment-zibal @amirhossein-moloki/payment-core
```

## نحوه استفاده

```ts
import { GatewayRegistry, Payment } from '@amirhossein-moloki/payment-core';
import { ZibalGateway } from '@amirhossein-moloki/payment-zibal';

const registry = new GatewayRegistry();

const zibalGateway = new ZibalGateway({
  merchant: 'zibal', // برای تست از 'zibal' استفاده کنید
  callbackUrl: 'https://yourdomain.com/callback',
});

registry.register(zibalGateway);

// Create Payment
const payment = Payment.create({
  id: 'order-1001',
  amount: 500000, // Rial
  currency: 'IRR',
  gatewayId: 'zibal',
  description: 'خرید شارژ',
});

const result = await zibalGateway.createPayment({ payment });
console.log(result.redirectUrl);

// Verify Payment
const verifyResult = await zibalGateway.verify({
  paymentId: 'order-1001',
  amount: 500000,
  currency: 'IRR',
  gatewayTransactionId: result.gatewayTransactionId,
});
```

## قابلیت‌ها (Capabilities)

- `CREATE_PAYMENT`
- `VERIFY`
- `INQUIRY`
- `CALLBACK`

## Sandbox / Test Environment

- **Sandbox Availability**: Yes (Test Mode).
- **Endpoint**: `https://gateway.zibal.ir` (Production endpoint configured in test mode).
- **Sandbox Credentials**: `merchant: "zibal"`.
- **Environment Selection**: Set `environment: "sandbox"` in `ZibalConfig`.
- **Production Safety**: Attempting to use test merchant `"zibal"` when `environment: "production"` throws `ConfigurationError`.
- **Supported Test Operations**: Payment Request (`/v1/request`), Redirect (`/start/{trackId}`), Verify (`/v1/verify`), Inquiry (`/v1/inquiry`), Callback parsing.
- **Unsupported Test Operations**: Refunds and Webhooks are not part of the Zibal IPG API specification (`ziball.json`).

## تست‌ها

```bash
pnpm --filter @amirhossein-moloki/payment-zibal test
```

Opt-in sandbox integration tests:

```bash
RUN_SANDBOX_TESTS=true pnpm --filter @amirhossein-moloki/payment-zibal test
```
