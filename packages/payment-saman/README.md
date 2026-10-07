# @company/payment-saman

درگاه پرداخت سامان کیش (SEP) برای اکوسیستم `@amirhossein-moloki/payment-core`.

## Source of Truth

پیاده‌سازی این پکیج کاملاً مستند بر اساس فایل `Saman.json` (کالکشن رسمی Postman) انجام شده است.

## نصب

```bash
pnpm add @company/payment-saman @amirhossein-moloki/payment-core
```

## نحوه استفاده

```ts
import { GatewayRegistry, Payment } from '@amirhossein-moloki/payment-core';
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

## Sandbox / Test Environment

- **Sandbox Availability**: Unknown / Not Documented in Postman collection specification (`Saman.json`).
- **Endpoint**: `https://sep.shaparak.ir/OnlinePG/OnlinePG` (Production endpoint).
- **Environment Selection**: Set `environment: "sandbox"` in `SamanConfig`.
- **Required Configuration for Sandbox**: Custom `tokenUrl` and `verifyUrl` test endpoints must be supplied when using sandbox mode.
- **Production Safety**: Initializing with `environment: "sandbox"` without providing custom test URLs throws `ConfigurationError`.
- **Supported Test Operations**: Token Request (`GetToken`), `VerifyTranscation`, `ReverseTranscation`, Callback parsing.

## تست‌ها

```bash
pnpm --filter @company/payment-saman test
```
