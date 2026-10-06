# @company/payment-mellat

A production-ready Mellat Payment Service Provider (PSP / به پرداخت ملت) integration package for Node.js & TypeScript, built for `@company/payment-core`.

## Reference / Source of Truth

This package implementation is strictly derived from and compliant with:

`Mellat.md` (شرح توابع و متدهای دروازه پرداخت اینترنتی بانک ملت — نگارش 1.29)

---

## Capabilities

- **`CREATE_PAYMENT`**: `bpPayRequest` SOAP call & HTTP redirect form generation (`startpay.mellat`)
- **`VERIFY`**: `bpVerifyRequest` SOAP call
- **`INQUIRY`**: `bpInquiryRequest` SOAP call
- **`REVERSE`**: `bpReversalRequest` SOAP call
- **`REFUND`**: `bpRefundRequest` SOAP call
- **`CALLBACK`**: HTTP POST callback parsing & verification (`RefId`, `ResCode`, `SaleOrderId`, `SaleReferenceId`)

---

## Installation

```bash
pnpm add @company/payment-core @company/payment-mellat
```

---

## Configuration

```ts
import { MellatConfig } from '@company/payment-mellat';

const config: MellatConfig = {
  gatewayId: 'mellat', // Unique gateway identifier
  terminalId: '1234567', // Merchant terminal ID (PSP)
  userName: 'merchantUsername', // Merchant username (PSP)
  userPassword: 'merchantPassword', // Merchant password (PSP)
  callbackUrl: 'https://mysite.com/payment/callback', // Registered domain callback URL
};
```

---

## Registration & Usage

```ts
import { GatewayRegistry, Payment } from '@company/payment-core';
import { MellatGateway } from '@company/payment-mellat';

const registry = new GatewayRegistry();
const mellatGateway = new MellatGateway(config);

registry.register(mellatGateway);

// Create Payment
const payment = new Payment({
  id: 'ORDER_1001',
  amount: 250000,
  currency: 'IRR',
  gatewayId: 'mellat',
});

const result = await mellatGateway.createPayment({ payment });
console.log(result.redirectUrl); // https://bpm.shaparak.ir/pgwchannel/startpay.mellat
console.log(result.gatewayTransactionId); // RefId
```

---

## Error Handling

Mellat numeric response codes (e.g., `11` invalid card, `21` invalid merchant, `43` already verified, `421` invalid IP) are mapped into strongly-typed `PaymentPlatformError` instances (`GatewayError`, `ValidationError`).

---

## Sandbox / Test Environment

- **Sandbox Availability**: Partial. Historical documentation mentions test servers, but official specification v1.29 does not document current public test WSDL or payment page URLs.
- **Environment Selection**: Set `environment: "sandbox"` in `MellatConfig`.
- **Required Configuration for Sandbox**: A custom test `wsdlUrl` and `portalUrl` provided by Mellat/Behpardakht must be supplied in `MellatConfig`.
- **Production Safety**: Initializing with `environment: "sandbox"` without providing custom test URLs throws `ConfigurationError` to prevent accidental production calls.
- **Supported Test Operations**: `bpPayRequest`, `bpVerifyRequest`, `bpInquiryRequest`, `bpReversalRequest`, `bpRefundRequest`, `parseCallback`.
- **Known Limitations**: Webhooks are not supported by Mellat PSP specification.

## Testing

Run unit tests:

```bash
pnpm --filter @company/payment-mellat test
```

Opt-in live integration test:

```bash
MELLAT_INTEGRATION_TEST=true pnpm --filter @company/payment-mellat test
```
