# @company/payment-zibal

درگاه پرداخت زیبال برای اکوسیستم `@company/payment-core`.

## Source of Truth

پیاده‌سازی این پکیج کاملاً مستند بر اساس فایل `ziball.json` انجام شده است.

## نصب

```bash
pnpm add @company/payment-zibal @company/payment-core
```

## نحوه استفاده

```ts
import { GatewayRegistry, Payment } from '@company/payment-core';
import { ZibalGateway } from '@company/payment-zibal';

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

## تست‌ها

```bash
pnpm --filter @company/payment-zibal test
```
