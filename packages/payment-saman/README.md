# @company/payment-saman

درگاه پرداخت سامان کیش (SEP) برای اکوسیستم `@company/payment-core`.

## Source of Truth

پیاده‌سازی این پکیج کاملاً مستند بر اساس فایل `Saman.json` (کالکشن رسمی Postman) انجام شده است.

## نصب

```bash
pnpm add @company/payment-saman @company/payment-core
```

## نحوه استفاده

```ts
import { GatewayRegistry, Payment } from '@company/payment-core';
import { SamanGateway } from '@company/payment-saman';

const registry = new GatewayRegistry();

const samanGateway = new SamanGateway({
  terminalId: '12571198',
  redirectUrl: 'https://yourdomain.com/return',
});

registry.register(samanGateway);

// Create Payment
const payment = Payment.create({
  id: 'order-3003',
  amount: 10000, // Rial
  currency: 'IRR',
  gatewayId: 'saman',
});

const result = await samanGateway.createPayment({ payment });
console.log(result.gatewayTransactionId); // Token
```

## قابلیت‌ها (Capabilities)

- `CREATE_PAYMENT`
- `VERIFY`
- `REVERSE`
- `CALLBACK`

## تست‌ها

```bash
pnpm --filter @company/payment-saman test
```
