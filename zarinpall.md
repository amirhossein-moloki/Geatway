# گزارش فنی درگاه پرداخت زرین‌پال

## 1. معرفی

زرین‌پال به‌عنوان یکی از سرویس‌های پرداخت اینترنتی، API لازم برای ایجاد و مدیریت تراکنش‌های پرداخت را در اختیار توسعه‌دهندگان قرار می‌دهد.

در نسخه فعلی مستندات، بخش عمده قابلیت‌های API زرین‌پال، به‌جز فرآیند احراز هویت، از طریق **GraphQL Gateway** ارائه می‌شود.

آدرس Gateway:

`https://next.zarinpal.com/api/v4/graphql`

ارتباط با Gateway از طریق HTTP POST و با فرمت `application/json` انجام می‌شود.

---

## 2. احراز هویت

برای دسترسی به API، درخواست‌ها باید دارای Access Token باشند.

توکن در Header زیر ارسال می‌شود:

```http
Authorization: Bearer {ACCESS_TOKEN}
```

همچنین Header مربوط به نوع محتوا:

```http
Content-Type: application/json
```

در نظر گرفته می‌شود.

بنابراین ساختار کلی درخواست به شکل زیر است:

```http
POST https://next.zarinpal.com/api/v4/graphql/

Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
Accept: application/json
```

---

## 3. معماری GraphQL

زرین‌پال برای API نسخه 4 از GraphQL استفاده می‌کند.

در GraphQL دو نوع عملیات اصلی وجود دارد:

### Query

برای دریافت اطلاعات و اجرای عملیات خواندنی استفاده می‌شود.

نمونه:

```graphql
query {
  Tickets {
    id
    status
  }
}
```

### Mutation

برای اجرای عملیات تغییر‌دهنده یا ایجاد/ویرایش اطلاعات استفاده می‌شود.

نمونه:

```graphql
mutation {
  CardAdd(
    pan: "1111222233334444",
    expired_at: "2020-02-05 00:00:00"
  ) {
    id
  }
}
```

---

## 4. ارسال پارامتر

پارامترهای موردنیاز می‌توانند مستقیماً در Query یا Mutation ارسال شوند.

برای مثال:

```graphql
query {
  Tickets(limit: 15, offset: 10) {
    id
    status
  }
}
```

در این مثال:

- `limit` تعداد رکوردهای مورد درخواست را مشخص می‌کند.
- `offset` نقطه شروع دریافت رکوردها را مشخص می‌کند.

---

## 5. ساختار داده‌ها

GraphQL زرین‌پال از Typeهای مختلفی استفاده می‌کند.

مهم‌ترین Typeها عبارت‌اند از:

| Type | کاربرد |
|---|---|
| `String` | رشته متنی |
| `Int` | عدد صحیح |
| `DateTime` | تاریخ و زمان |
| `ID` | شناسه یکتا |
| `Boolean` | مقدار صحیح/غلط |
| `Enum` | مجموعه‌ای از مقادیر مشخص |

علامت `!` در GraphQL نشان‌دهنده **Non-Null** بودن مقدار است.

برای مثال:

```graphql
String!
```

یعنی مقدار رشته‌ای باید حتماً وجود داشته باشد.

همچنین برای تعریف لیست‌ها از ساختاری مانند زیر استفاده می‌شود:

```graphql
[Type!]!
```

---

## 6. نمونه درخواست HTTP

یک درخواست ساده به Gateway زرین‌پال:

```bash
curl 'https://next.zarinpal.com/api/v4/graphql/' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer {ACCESS_TOKEN}' \
  --data-binary '{
    "query":"query { Application { application, platform } }",
    "variables":null
  }'
```

در این درخواست، Query از طریق Body ارسال شده و Access Token در Header قرار گرفته است.

---

## 7. ساختار کلی درخواست GraphQL

بدنه درخواست معمولاً شامل دو بخش اصلی است:

```json
{
  "query": "...",
  "variables": null
}
```

فیلد `query` شامل دستور GraphQL است.

فیلد `variables` برای ارسال پارامترهای متغیر مورد استفاده قرار می‌گیرد و در صورت عدم نیاز می‌تواند `null` باشد.

---

## 8. نمونه پیاده‌سازی در Node.js

برای استفاده از SDK رسمی Node.js زرین‌پال می‌توان از پکیج زیر استفاده کرد:

```bash
npm install zarinpal-node-sdk
```

یا:

```bash
yarn add zarinpal-node-sdk
```

یا:

```bash
pnpm add zarinpal-node-sdk
```

نسخه Node.js مورد نیاز طبق مستندات ارائه‌شده، **14 یا بالاتر** است.

همچنین در صورت نیاز می‌توان بدون SDK و مستقیماً با HTTP/GraphQL با API ارتباط برقرار کرد.

نمونه ساده:

```javascript
const response = await fetch(
  'https://next.zarinpal.com/api/v4/graphql/',
  {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      query: `
        query {
          Application {
            application
            platform
          }
        }
      `,
      variables: null
    })
  }
);

const data = await response.json();

console.log(data);
```

---

## 9. جریان کلی پرداخت

برای پیاده‌سازی یک سیستم پرداخت اینترنتی، فرآیند کلی را می‌توان به مراحل زیر تقسیم کرد:

### مرحله اول: احراز هویت

برنامه ابتدا Access Token معتبر دریافت می‌کند.

### مرحله دوم: ایجاد درخواست پرداخت

اطلاعات پرداخت شامل مبلغ، اطلاعات سفارش و سایر پارامترهای موردنیاز به API ارسال می‌شود.

### مرحله سوم: دریافت اطلاعات پرداخت

در صورت موفق بودن درخواست، اطلاعات لازم برای ادامه فرآیند پرداخت دریافت می‌شود.

### مرحله چهارم: انتقال کاربر

کاربر به صفحه پرداخت زرین‌پال منتقل می‌شود تا عملیات پرداخت را انجام دهد.

### مرحله پنجم: Callback

پس از پایان عملیات پرداخت، کاربر به آدرس Callback تعریف‌شده توسط فروشگاه بازگردانده می‌شود.

### مرحله ششم: Verify

در سمت سرور باید نتیجه تراکنش از طریق API زرین‌پال بررسی و تأیید شود.

### مرحله هفتم: ثبت نتیجه

پس از تأیید موفقیت‌آمیز، تراکنش باید در سیستم داخلی فروشگاه ثبت شده و سفارش به وضعیت پرداخت‌شده تغییر کند.

---

## 10. نکات امنیتی

Access Token نباید در سمت Client یا Frontend قرار گیرد.

بهتر است Token در متغیرهای محیطی نگهداری شود:

```env
ZARINPAL_ACCESS_TOKEN=your_access_token
```

و در Backend استفاده شود.

همچنین نتیجه پرداخت نباید صرفاً بر اساس بازگشت کاربر از صفحه پرداخت معتبر تلقی شود. تأیید نهایی تراکنش باید در سمت سرور و از طریق فرآیند Verify انجام شود.

---

## 11. محیط تست GraphQL

برای بررسی و آزمایش Queryها می‌توان از محیط GraphiQL ارائه‌شده توسط زرین‌پال استفاده کرد:

`https://api.zarinpal.com/api/v4/docs/graphiql`

GraphiQL امکان آزمایش مستقیم Query و Mutationهای GraphQL را فراهم می‌کند.

---

## 12. مزایا و ویژگی‌های فنی

مهم‌ترین ویژگی‌های معماری API ارائه‌شده عبارت‌اند از:

- استفاده از GraphQL
- امکان دریافت دقیق فیلدهای موردنیاز
- پشتیبانی از Query و Mutation
- امکان ارسال پارامترها
- استفاده از Access Token برای احراز هویت API
- امکان استفاده مستقیم از HTTP بدون وابستگی به SDK
- ارائه SDK اختصاصی برای Node.js
- وجود محیط GraphiQL برای تست API

---

## 13. جمع‌بندی

زرین‌پال در نسخه 4 API خود از معماری GraphQL استفاده می‌کند و بخش عمده عملیات API از طریق Gateway زیر در دسترس است:

```text
https://next.zarinpal.com/api/v4/graphql
```

ارتباط با API از طریق HTTP POST انجام شده و درخواست‌ها به صورت JSON ارسال می‌شوند. احراز هویت نیز با استفاده از Bearer Access Token انجام می‌شود.

ساختار GraphQL امکان استفاده از Query برای دریافت اطلاعات و Mutation برای اجرای عملیات تغییر‌دهنده را فراهم می‌کند.

برای توسعه با Node.js نیز SDK رسمی با نام `zarinpal-node-sdk` ارائه شده است.

در یک پیاده‌سازی استاندارد پرداخت، فرآیند باید از احراز هویت و ایجاد درخواست پرداخت آغاز شده، سپس کاربر به صفحه پرداخت هدایت شود و پس از بازگشت، تراکنش در سمت سرور Verify و نتیجه آن ثبت شود.