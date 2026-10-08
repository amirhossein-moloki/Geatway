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
- **پشتیبانی کامل از داکر (Docker & Docker Compose)**: اجرای آسان، محیط تست ایزوله و اجرای سرور یا اسکریپت‌های تست در داکر.

## نحوه راه اندازی و اجرا (روش معمولی)

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

---

## نحوه راه اندازی و اجرا با داکر (Docker & Docker Compose)

شما می‌توانید کل محیط تست `depix-test` را به سادگی با استفاده از Docker Compose اجرا نمایید:

### 1. ساخت ایمیج داکر

```bash
pnpm --filter depix-test docker:build
# یا مستقیماً
docker compose build
```

### 2. اجرای سرور HTTP

```bash
pnpm --filter depix-test docker:start
# یا مستقیماً
docker compose up server
```

سرور روی پورت `3000` در دسترس خواهد بود (`http://localhost:3000`).

### 3. اجرای تست‌های Vitest در داکر

```bash
pnpm --filter depix-test docker:test
# یا مستقیماً
docker compose run --rm test
```

### 4. اجرای اسکریپت تست CLI در داکر

```bash
pnpm --filter depix-test docker:cli
# یا مستقیماً
docker compose run --rm cli-test
```
