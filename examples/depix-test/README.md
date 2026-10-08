# Depix Test Application (`depix-test`)

این پروژه یک محیط واقعی و تست کامل برای تمامی درگاه‌های پرداخت پشتیبانی‌شده (ملت، زیبال، زرین‌پال، سامان و Mock) با استفاده از پکیج‌های اکوسیستم پرداخت ارائه می‌دهد.

## ویژگی‌ها

- **یکپارچه‌سازی کامل تمامی درگاه‌ها**:
  - Mellat (`@amirhossein-moloki/payment-mellat`)
  - Zibal (`@amirhossein-moloki/payment-zibal`)
  - Zarinpal (`@amirhossein-moloki/payment-zarinpal`)
  - Saman (`@amirhossein-moloki/payment-saman`)
  - Mock (`@amirhossein-moloki/payment-service/testing`)
- **سرور واقعی HTTP**: رابط REST API بدون وابستگی‌های سنگین خارجی برای ساخت، تایید، استعلام، مرجوعی و مدیریت Callbackها.
- **تست خودکار CLI**: ابزار CLI برای اجرای خودکار چرخه کامل پرداخت در تمامی درگاه‌ها.
- **تست‌های Vitest**: تست‌های یکپارچه‌سازی کامل سرتاسری.

## نحوه راه اندازی و اجرا

1. نصب وابستگی‌ها و بیلد پروژه:

```bash
pnpm install
pnpm --filter depix-test build
```

2. ساخت فایل `.env`:

```bash
cp .env.example .env
```

3. اجرای سرور HTTP:

```bash
pnpm --filter depix-test start
```

4. اجرای اسکریپت تست CLI:

```bash
node dist/cli-test.js
```

5. اجرای تست‌های واحد/یکپارچه‌سازی:

```bash
pnpm --filter depix-test test
```
