# Payment Provider Capabilities & Matrix

This document provides an exhaustive specification of supported capabilities, configuration requirements, and environment handling across all payment providers in the ecosystem.

---

## 1. Provider Capability Matrix

| Gateway ID | Display Name           | Create Payment | Verify | Inquiry | Refund | Reverse | Cancel | Callback | Webhook |
| ---------- | ---------------------- | :------------: | :----: | :-----: | :----: | :-----: | :----: | :------: | :-----: |
| `mellat`   | به پرداخت ملت (Mellat) |       ✓        |   ✓    |    ✓    |   ✓    |    ✓    |   ✗    |    ✓     |    ✗    |
| `zibal`    | زیبال (Zibal)          |       ✓        |   ✓    |    ✓    |   ✗    |    ✗    |   ✗    |    ✓     |    ✗    |
| `zarinpal` | زرین‌پال (Zarinpal)    |       ✓        |   ✓    |    ✗    |   ✗    |    ✗    |   ✗    |    ✓     |    ✗    |
| `saman`    | سامان کیش / SEP        |       ✓        |   ✓    |    ✗    |   ✗    |    ✓    |   ✗    |    ✓     |    ✗    |

---

## 2. Provider Detailed Specifications

### 2.1. Mellat (`@amirhossein-moloki/payment-mellat`)

- **Package**: `@amirhossein-moloki/payment-mellat`
- **Gateway ID**: `mellat`
- **Supported Capabilities**:
  - `CREATE_PAYMENT` (Mellat `payRequest`)
  - `VERIFY` (Mellat `verifyRequest`)
  - `INQUIRY` (Mellat `inquiryRequest`)
  - `REFUND` (Mellat `refundRequest`)
  - `REVERSE` (Mellat `reversalRequest`)
  - `CALLBACK` (Mellat callback POST form parser)
- **Configuration Schema**:
  ```ts
  interface MellatConfig {
    gatewayId?: string; // Default: 'mellat'
    terminalId: number;
    userName: string;
    userPassword: string;
    callbackUrl: string;
    environment?: 'sandbox' | 'production';
  }
  ```
- **Redirect Mechanism**: HTML Form POST submitting `RefId` to Mellat bank gateway URL.

---

### 2.2. Zibal (`@amirhossein-moloki/payment-zibal`)

- **Package**: `@amirhossein-moloki/payment-zibal`
- **Gateway ID**: `zibal`
- **Supported Capabilities**:
  - `CREATE_PAYMENT` (Zibal `/v1/request`)
  - `VERIFY` (Zibal `/v1/verify`)
  - `INQUIRY` (Zibal `/v1/inquiry`)
  - `CALLBACK` (Zibal callback parser)
- **Configuration Schema**:
  ```ts
  interface ZibalConfig {
    gatewayId?: string; // Default: 'zibal'
    merchant: string; // Use 'zibal' for sandbox mode
    callbackUrl: string;
    environment?: 'sandbox' | 'production';
  }
  ```
- **Redirect Mechanism**: Direct HTTP GET redirect to `https://gateway.zibal.ir/start/{trackId}`.

---

### 2.3. Zarinpal (`@amirhossein-moloki/payment-zarinpal`)

- **Package**: `@amirhossein-moloki/payment-zarinpal`
- **Gateway ID**: `zarinpal`
- **Supported Capabilities**:
  - `CREATE_PAYMENT` (Zarinpal v4 `PaymentRequest`)
  - `VERIFY` (Zarinpal v4 `PaymentVerification`)
  - `CALLBACK` (Zarinpal callback parser)
- **Configuration Schema**:
  ```ts
  interface ZarinpalConfig {
    gatewayId?: string; // Default: 'zarinpal'
    accessToken: string;
    merchantId?: string;
    callbackUrl: string;
    environment?: 'sandbox' | 'production';
  }
  ```
- **Redirect Mechanism**: Direct HTTP GET redirect to `https://www.zarinpal.com/pg/StartPay/{authority}` (or sandbox URL).

---

### 2.4. Saman (`@amirhossein-moloki/payment-saman`)

- **Package**: `@amirhossein-moloki/payment-saman`
- **Gateway ID**: `saman`
- **Supported Capabilities**:
  - `CREATE_PAYMENT` (Saman token request)
  - `VERIFY` (Saman transaction verify)
  - `REVERSE` (Saman transaction reverse)
  - `CALLBACK` (Saman callback parser)
- **Configuration Schema**:
  ```ts
  interface SamanConfig {
    gatewayId?: string; // Default: 'saman'
    terminalId: string;
    redirectUrl: string;
    environment?: 'sandbox' | 'production';
  }
  ```
- **Redirect Mechanism**: Form POST submitting `Token` to Saman SEP payment URL.
