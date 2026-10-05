# Payment Gateway Integration Specification
## شرکت به‌پرداخت ملت — دروازه پرداخت اینترنتی بانک ملت
### Documentation Version: 1.29 — تیرماه 1402

---

# 1. اطلاعات کلی PSP

```yaml
provider_name: "به پرداخت ملت"
provider_company: "شرکت به پرداخت ملت"
bank: "بانک ملت"
gateway_name: "دروازه پرداخت اینترنتی بانک ملت"
documentation_version: "1.29"
documentation_date: "تیرماه 1402"
source_document: "راهنمای کاربران: شرح توابع و متدهای دروازه پرداخت اینترنتی بانک ملت، نگارش 1.29"
```

**محدوده مستند:** پرداخت اینترنتی مبتنی بر Web Service. موارد کارتخوان، USSD و سرویس‌های غیرمرتبط با Web Payment در این Specification وارد نشده‌اند، به‌جز `bpRefundRequest` که خود مستند آن را برای تراکنش اینترنتی و POS تعریف کرده است.

---

# 2. نوع اتصال

```yaml
protocol: "SOAP over HTTP/HTTPS"
api_style: "SOAP"
authentication:
  type: "terminalId + userName + userPassword"
  additional_network_control: "Merchant Server IP must be registered with به پرداخت ملت"

encoding: "XML"
content_type: "NOT_DOCUMENTED"
tls_required: "NOT_DOCUMENTED"
transport:
  http: "supported according to document"
  https: "supported according to document"
```

مستند صراحتاً اعلام می‌کند که ارتباط Web Service در لایه پایین با SOAP و XML انجام شده و Transport می‌تواند HTTP یا HTTPS باشد. همچنین آدرس عملیاتی ارائه‌شده HTTPS است.

**پیش‌نیاز شبکه:**

```yaml
merchant_server_ip_registration: REQUIRED_FROM_PSP
ports:
  80: "must be open"
  443: "must be open"
```

منبع: صفحات 7 و 10.

---

# 3. Endpointها

## 3.1 SOAP Web Service

```yaml
endpoints:
  - name: "Mellat PGW SOAP Web Service"
    purpose: "Web Payment Web Service"
    method: "SOAP operation"
    url: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"
    wsdl: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"
    namespace: NOT_DOCUMENTED
    service: NOT_DOCUMENTED
    port: NOT_DOCUMENTED
    operation:
      - "bpPayRequest"
      - "bpChargePayRequest"
      - "bpVerifyRequest"
      - "bpSettleRequest"
      - "bpInquiryRequest"
      - "bpReversalRequest"
      - "bpRefundRequest"
      - "bpRefundToPANRequest"
      - "bpDynamicPayRequest"
      - "bpCumulativeDynamicPayRequest"
    authentication:
      - "terminalId"
      - "userName"
      - "userPassword"
    headers: NOT_DOCUMENTED
    request_format: "SOAP/XML"
    response_format: "SOAP/XML or operation return value as described"
    source: "Page 10"
```

**نکته:** مستند متن WSDL را ارائه نکرده و فقط URL WSDL را اعلام کرده است؛ بنابراین `namespace`، `service` و `port` قابل استخراج قطعی از متن ارائه‌شده نیستند و `NOT_DOCUMENTED` باقی می‌مانند.

---

## 3.2 Payment Page — فارسی

```yaml
name: "Persian Payment Page"
purpose: "Redirect customer to payment page"
method: "POST"
url: "https://bpm.shaparak.ir/pgwchannel/startpay.mellat"
wsdl: NOT_DOCUMENTED
namespace: NOT_DOCUMENTED
service: NOT_DOCUMENTED
port: NOT_DOCUMENTED
operation: NOT_DOCUMENTED
authentication: "RefId"
headers:
  Referer:
    required: true
    value: "Merchant registered Domain/SubDomain"
request_format: "application/x-www-form-urlencoded HTML Form POST"
response_format: "HTML Payment Page"
source: "Pages 12, 13, 15, 16"
```

---

## 3.3 Payment Page — انگلیسی

```yaml
name: "English Payment Page"
purpose: "Redirect customer to English payment page"
method: "POST"
url: "https://bpm.shaparak.ir/pgwchannel/enstartpay.mellat"
authentication: "RefId"
headers:
  Referer:
    required: true
    value: "Merchant registered Domain/SubDomain"
request_format: "HTML Form POST"
response_format: "HTML Payment Page"
source: "Page 12"
```

---

## 3.4 Payment Page — خرید کالای ایرانی

```yaml
name: "Iranian Goods Credit Payment Page"
purpose: "Payment page for Iranian goods credit transaction"
method: "POST"
url: "https://bpm.shaparak.ir/pgwCreditchannel/startpay.mellat"
authentication: "RefId"
request_format: "HTML Form POST"
response_format: "HTML Payment Page"
source: "Page 12"
```

---

# 4. Flow کامل پرداخت

مستند سه تابع اول را توابع اصلی یک Payment Flow سالم معرفی می‌کند:

```text
Merchant
   |
   | bpPayRequest
   | terminalId, userName, userPassword,
   | orderId, amount, localDate, localTime,
   | additionalData, callBackUrl, payerId, ...
   v
Mellat SOAP Web Service
   |
   | "0, RefId"
   v
Merchant
   |
   | HTTP POST
   | RefId
   | + Referer header
   v
Mellat Payment Page
   |
   | Cardholder performs payment
   v
Merchant Callback URL
   |
   | POST:
   | RefId
   | ResCode
   | SaleOrderId
   | SaleReferenceId
   | CardHolderPan
   | ...
   v
Merchant
   |
   | if ResCode == "0"
   | bpVerifyRequest
   v
Mellat
   |
   | Verify result
   v
Merchant
   |
   | bpSettleRequest
   v
Mellat
   |
   | "0" = successful receipt of settlement request
   v
Merchant
```

### Failure / Unknown Status Flow

```text
bpVerifyRequest
      |
      | no usable response / status unknown
      v
bpInquiryRequest
      |
      | status still cannot be determined
      v
bpReversalRequest
```

### Auto-Reversal

اگر `bpVerifyRequest` برای تراکنش موفق Sale ظرف **20 دقیقه** ارسال نشود، Gateway درخواست Auto-Reversal را به شبکه بانکی ارسال می‌کند و تراکنش ناموفق تلقی شده و وجه به دارنده کارت برگشت داده می‌شود.

منبع: صفحات 8، 11، 18 و 19.

```yaml
payment_flow:
  - step: 1
    operation: "bpPayRequest"
    direction: "Merchant -> Mellat"
    endpoint: "Mellat SOAP Web Service"
    required_parameters:
      - terminalId
      - userName
      - userPassword
      - orderId
      - amount
      - localDate
      - localTime
      - additionalData
      - callBackUrl
      - payerId
    response: "ResCode, RefId"
    next_step: "POST RefId to Payment Page if ResCode == 0"
    failure_behavior: "Do not redirect; inspect ResCode"

  - step: 2
    operation: "Redirect"
    direction: "Merchant Browser -> Mellat Payment Page"
    endpoint: "https://bpm.shaparak.ir/pgwchannel/startpay.mellat"
    required_parameters:
      - RefId
    response: "Payment Page"
    next_step: "Cardholder payment"
    failure_behavior: "NOT_DOCUMENTED"

  - step: 3
    operation: "Callback"
    direction: "Mellat Payment Page -> Merchant callback"
    endpoint: "Merchant callBackUrl"
    required_parameters:
      - RefId
      - ResCode
      - SaleOrderId
      - SaleReferenceId
    response: "NOT_DOCUMENTED"
    next_step: "Validate RefId and SaleOrderId, then Verify if ResCode == 0"
    failure_behavior: "If RefId/SaleOrderId mismatch, treat transaction as invalid and do not call Verify"

  - step: 4
    operation: "bpVerifyRequest"
    direction: "Merchant -> Mellat"
    endpoint: "Mellat SOAP Web Service"
    required_parameters:
      - terminalId
      - userName
      - userPassword
      - orderId
      - saleOrderId
      - saleReferenceId
    response: "Response code"
    next_step: "bpSettleRequest on successful Verify"
    failure_behavior: "Retry Verify if initial response code is not 0, until appropriate result is obtained"

  - step: 5
    operation: "bpSettleRequest"
    direction: "Merchant -> Mellat"
    endpoint: "Mellat SOAP Web Service"
    required_parameters:
      - terminalId
      - userName
      - userPassword
      - orderId
      - saleOrderId
      - saleReferenceId
    response: "0 means successful receipt of settlement request"
    next_step: "Settlement"
    failure_behavior: "NOT_DOCUMENTED"

  - step: 6
    operation: "bpInquiryRequest"
    direction: "Merchant -> Mellat"
    endpoint: "Mellat SOAP Web Service"
    required_parameters:
      - terminalId
      - userName
      - userPassword
      - orderId
      - saleOrderId
      - saleReferenceId
    response: "Transaction status"
    next_step: "Determine transaction state"
    failure_behavior: "If status remains unknown, bpReversalRequest"

  - step: 7
    operation: "bpReversalRequest"
    direction: "Merchant -> Mellat"
    endpoint: "Mellat SOAP Web Service"
    required_parameters:
      - terminalId
      - userName
      - userPassword
      - orderId
      - saleOrderId
      - saleReferenceId
    response: "Response code"
    next_step: "End / refund according to gateway result"
    failure_behavior: "NOT_DOCUMENTED"
```

---

# 5. اطلاعات Merchant

```yaml
merchant_credentials:
  terminal_id: REQUIRED_FROM_PSP
  username: REQUIRED_FROM_PSP
  password: REQUIRED_FROM_PSP
  merchant_id: NOT_DOCUMENTED
  api_key: NOT_DOCUMENTED
  secret_key: NOT_DOCUMENTED
  callback_url: REQUIRED_FROM_MERCHANT
  other_credentials:
    merchant_server_ip: REQUIRED_FROM_PSP
    registered_domain_or_subdomain: REQUIRED_FROM_PSP
    payment_identifier:
      status: "Only if enabled for merchant account"
      value: REQUIRED_FROM_PSP
    subServiceId:
      status: "Required only for Dynamic Payment / Type 2"
      value: REQUIRED_FROM_PSP
```

مستند می‌گوید IP سرور پذیرنده باید قبلاً به شرکت به‌پرداخت اعلام شده باشد.

منبع: صفحات 10 و 16.

---

# 6. Create Payment / Pay Request

## 6.1 bpPayRequest

```yaml
create_payment:
  operation: "bpPayRequest"
  method: "SOAP operation"
  endpoint: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"

  request_fields:

    - name: "terminalId"
      type: "long"
      required: true
      length: NOT_DOCUMENTED
      format: NOT_DOCUMENTED
      description: "شماره پایانه پذیرنده"
      example: "1234"
      source: "Page 13"

    - name: "userName"
      type: "string"
      required: true
      length: NOT_DOCUMENTED
      format: NOT_DOCUMENTED
      description: "نام کاربری پذیرنده"
      example: "******"
      source: "Page 13"

    - name: "userPassword"
      type: "string"
      required: true
      length: NOT_DOCUMENTED
      format: NOT_DOCUMENTED
      description: "کلمه عبور پذیرنده"
      example: "******"
      source: "Page 13"

    - name: "orderId"
      type: "long"
      required: true
      length: NOT_DOCUMENTED
      format: NOT_DOCUMENTED
      description: "شماره درخواست پرداخت؛ برای bpPayRequest باید یکتا باشد"
      example: "10"
      source: "Pages 13, 16"

    - name: "amount"
      type: "long"
      required: true
      length: NOT_DOCUMENTED
      format: NOT_DOCUMENTED
      description: "مبلغ خرید"
      example: "1"
      source: "Page 13"

    - name: "localDate"
      type: "string"
      required: true
      length: 8
      format: "YYYYMMDD"
      description: "تاریخ درخواست"
      example: "20091008"
      source: "Page 13"

    - name: "localTime"
      type: "string"
      required: true
      length: 6
      format: "HHMMSS"
      description: "ساعت درخواست"
      example: "102003"
      source: "Page 13"

    - name: "additionalData"
      type: "string"
      required: true
      length: "maximum 1000 characters"
      format: NOT_DOCUMENTED
      description: "اطلاعات توضیحی قابل نگهداری برای تراکنش"
      example: NOT_DOCUMENTED
      source: "Page 13"

    - name: "callBackUrl"
      type: "string"
      required: true
      length: NOT_DOCUMENTED
      format: "URL"
      description: "آدرس بازگشت؛ باید در دامنه ثبت‌شده پذیرنده قرار داشته باشد"
      example: "http://www.mysite.com/myfolder/callbackmellat.aspx"
      source: "Pages 13, 16"

    - name: "payerId"
      type: "string"
      required: true
      length: NOT_DOCUMENTED
      format: NOT_DOCUMENTED
      description: "شناسه پرداخت‌کننده"
      example: "0"
      source: "Page 13"

    - name: "mobileNo"
      type: "string"
      required: false
      length: NOT_DOCUMENTED
      format: NOT_DOCUMENTED
      description: "شماره موبایل دارنده کارت"
      example: "989125305269"
      source: "Page 13"

    - name: "encPan"
      type: "string"
      required: false
      length: NOT_DOCUMENTED
      format: "Encrypted PAN"
      description: "شماره کارت رمز شده"
      example: "701EE799BCB9B5D4"
      source: "Page 13"

    - name: "panHiddenMode"
      type: "string"
      required: false
      length: NOT_DOCUMENTED
      format: "0 or 1 according to documented behavior"
      description: "وضعیت نمایش شماره کارت"
      example: "1"
      source: "Pages 13-14"

    - name: "cartItem"
      type: "string"
      required: false
      length: NOT_DOCUMENTED
      format: NOT_DOCUMENTED
      description: "متن دلخواه پذیرنده برای نمایش در درگاه؛ در متن جدول برای خرید شارژ اعتباری آمده است"
      example: NOT_DOCUMENTED
      source: "Page 13"

    - name: "enc"
      type: "string"
      required: false
      length: NOT_DOCUMENTED
      format: "Encrypted National Code"
      description: "کد ملی رمز شده دارنده کارت"
      example: "04EAE799BC894BFF"
      source: "Pages 13, 15"
```

### Response

```yaml
response_fields:
  - name: "ResCode"
    type: "string"
    required: true
    description: "کد پاسخ"
    example: "0"
    source: "Page 12"

  - name: "RefId"
    type: "string"
    required: true
    description: "Hashcode تولیدشده پس از درخواست موفق"
    example: "AF82041a2Bf6989c7fF9"
    source: "Page 12"
```

Response به شکل زیر مستند شده است:

```text
0, AF82041a2Bf6989c7fF9
```

```yaml
success_response:
  ResCode: "0"
  RefId: "generated by gateway"

failure_response:
  ResCode: "non-zero"
  RefId: "no new valid RefId should be used"
```

در صورت `ResCode == 0`، `RefId` باید با POST به Payment Page ارسال شود.

---

# 7. Redirect / Payment Page

```yaml
redirect:
  method: "POST"
  url: "https://bpm.shaparak.ir/pgwchannel/startpay.mellat"
  parameters:
    - "RefId"
    - "MobileNo"
    - "HiddenMode"
    - "EncPan"
    - "ENC"
    - "merchantName"
    - "merchantAddress"
    - "CartItem"
  token_field: "RefId"
  required_fields:
    - "RefId"
  example: |
    <form name="input"
          action="https://bpm.shaparak.ir/pgwchannel/startpay.mellat"
          method="post"
          target="_blank">
      <input type="text" id="RefId" name="RefId" />
      <input type="submit" value="Submit" />
    </form>
```

### Redirect Header

```yaml
headers:
  Referer:
    required: true
    description: "آدرس Domain سایت پذیرنده"
    validation: "Must match Domain or SubDomain previously registered by merchant"
```

در صورت عدم تطابق `Referer` با Domain/SubDomain ثبت‌شده، تراکنش با خطا مواجه می‌شود.

### Optional Redirect Fields

```yaml
redirect_optional_fields:

  - name: "MobileNo"
    purpose: "Profile ID / card storage functionality"
    condition: "optional"
    source: "Page 13"

  - name: "HiddenMode"
    purpose: "Controls PAN display"
    values:
      "0": "Full PAN displayed read-only"
      "1": "Only last 4 digits displayed read-only"
    source: "Page 14"

  - name: "EncPan"
    purpose: "Encrypted card number"
    condition: "optional"
    encryption:
      algorithm: "DES/ECB/NoPadding"
      key: "2C7D202B960A96AA"
    source: "Page 14"

  - name: "ENC"
    purpose: "Encrypted cardholder National Code"
    condition: "optional"
    encryption:
      algorithm: "DES/ECB/PKCS5Padding"
      key: "2C7D202B960A96AA"
    source: "Page 15"

  - name: "merchantName"
    purpose: "Display merchant name on payment page"
    condition: "optional"
    source: "Page 15"

  - name: "merchantAddress"
    purpose: "Display merchant address on payment page"
    condition: "optional"
    source: "Page 15"
```

**توجه:** مستند برای احراز هویت مانا می‌گوید کلید رمزنگاری کد ملی باید «کلید توافقی فی‌مابین پذیرنده و شرکت شاپرک» باشد؛ در بخش احراز هویت قوی، کلید ثابت `2C7D202B960A96AA` آمده است. این دو مورد نباید با یکدیگر ادغام شوند.

---

# 8. Callback

```yaml
callback:
  method: "POST"
  url: "Merchant callBackUrl"
  parameters:

    - name: "RefId"
      type: "string"
      required: true
      description: "Reference generated during payment request"
      example: "AF82041a2Bf6989c7fF9"

    - name: "ResCode"
      type: "string"
      required: true
      description: "Purchase status according to response-code table"
      example: "0"

    - name: "SaleOrderId"
      type: "long"
      required: true
      description: "Purchase request number"
      example: "10"

    - name: "SaleReferenceId"
      type: "long"
      required: true
      description: "Purchase transaction reference code"
      example: "127926981246"

    - name: "CardHolderPan"
      type: "string"
      required: true
      description: "First 6 and last 4 digits of customer card"
      example: "610433*****5689"

    - name: "CreditCardSaleResponseDetail"
      type: "string"
      required: conditional
      description: "Iranian goods credit transaction response detail"
      example: "00"
      
    - name: "FinalAmount"
      type: "long"
      required: conditional
      description: "Final amount deducted in online discount scheme"
      example: "480000"

  success_conditions:
    - "ResCode == 0"
    - "RefId matches the RefId generated for the same payment request"
    - "SaleOrderId matches the corresponding order"
  failure_conditions:
    - "ResCode != 0"
    - "RefId mismatch"
    - "SaleOrderId mismatch"
  transaction_status: "Must be validated using ResCode and subsequent Verify"
```

### Security Validation at Callback

قبل از `bpVerifyRequest`:

```yaml
callback_validation:
  validate_ref_id: true
  validate_sale_order_id: true
  validation_scope: "Same transaction"
  mismatch_action: "Treat transaction as invalid and do not call bpVerifyRequest"
```

منبع: صفحه 27.

---

# 9. Verify

```yaml
verify:
  required: true
  operation: "bpVerifyRequest"
  method: "SOAP operation"
  endpoint: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"

  request_fields:

    - name: "terminalId"
      type: "long"
      required: true
      description: "شماره پایانه پذیرنده"
      example: "1234"

    - name: "userName"
      type: "string"
      required: true
      description: "نام کاربری"
      example: "******"

    - name: "userPassword"
      type: "string"
      required: true
      description: "رمز عبور"
      example: "******"

    - name: "orderId"
      type: "long"
      required: true
      description: "شماره درخواست تایید تراکنش"
      example: "11"

    - name: "saleOrderId"
      type: "long"
      required: true
      description: "شماره درخواست خرید؛ همان OrderId مرحله قبل"
      example: "10"

    - name: "saleReferenceId"
      type: "long"
      required: true
      description: "کد مرجع تراکنش خرید"
      example: "127926981246"

  response_fields:
    - name: "ResponseCode"
      type: "string"
      description: "مقدار بازگشتی تابع؛ مستند آن را یک رشته حاوی کد پاسخ توصیف می‌کند"
      example: "0"

  success_condition:
    - "Response code == 0"
    - "Response may also indicate transaction was previously verified"

  failure_condition:
    - "Response code indicates failure"
    - "If initial ResCode is non-zero, bpVerifyRequest should be called again to obtain appropriate result"
```

### Verify Deadline

```yaml
verify_deadline:
  max_time: "20 minutes"
  consequence_if_not_verified:
    - "Gateway initiates Auto-Reversal"
    - "Transaction is considered unsuccessful"
    - "Funds are returned to cardholder"
```

منبع: صفحات 17–19.

---

# 10. Settle

```yaml
settlement:
  supported: true
  required: true
  operation: "bpSettleRequest"
  method: "SOAP operation"
  endpoint: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"

  request_fields:
    - name: "terminalId"
      type: "Long"
      required: true
      description: "Merchant terminal"
      example: "1234"

    - name: "userName"
      type: "String"
      required: true
      description: "Merchant username"
      example: "******"

    - name: "userPassword"
      type: "String"
      required: true
      description: "Merchant password"
      example: "******"

    - name: "orderId"
      type: "Long"
      required: true
      description: "Settlement request number"
      example: "21"

    - name: "saleOrderId"
      type: "Long"
      required: true
      description: "Purchase request number"
      example: "10"

    - name: "saleReferenceId"
      type: "Long"
      required: true
      description: "Purchase transaction reference; same value used in Verify"
      example: "127926981246"

  response_fields:
    - name: "ResponseCode"
      type: "string"
      required: true
      description: "Return value of settlement request"
      example: "0"

  success_condition: "Return value == 0 means successful receipt of settlement request"
  failure_condition: "NOT_DOCUMENTED"

  automatic: false
```

مستند می‌گوید بانک تراکنش‌های تأییدشده را با این عملیات تسویه می‌کند و اگر تراکنش موفق Settle نشود، واریز انجام نخواهد شد.

---

# 11. Inquiry

```yaml
inquiry:
  supported: true
  operation: "bpInquiryRequest"
  method: "SOAP operation"
  endpoint: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"

  request_fields:
    - name: "terminalId"
      type: "long"
      required: true
      description: "Merchant terminal"
      example: "1234"

    - name: "userName"
      type: "string"
      required: true
      description: "Merchant username"
      example: "******"

    - name: "userPassword"
      type: "string"
      required: true
      description: "Merchant password"
      example: "******"

    - name: "orderId"
      type: "long"
      required: true
      description: "Inquiry request number"
      example: "13"

    - name: "saleOrderId"
      type: "long"
      required: true
      description: "Purchase request number"
      example: "10"

    - name: "saleReferenceId"
      type: "long"
      required: true
      description: "Purchase transaction reference"
      example: "127926981246"

  response_fields:
    type: "NOT_DOCUMENTED in field-level form"
    description: "Returns transaction status"

  use_cases:
    - "When merchant does not receive result of bpVerifyRequest"
    - "When merchant needs to determine transaction status"
```

`orderId` این متد الزاماً یکتا نیست و مستند پیشنهاد می‌کند برای سهولت می‌توان آن را برابر `saleOrderId` قرار داد.

---

# 12. Reverse / Refund / Reversal

## 12.1 Reversal — bpReversalRequest

```yaml
reverse:
  supported: true
  operation: "bpReversalRequest"
  method: "SOAP operation"
  endpoint: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"

  request_fields:
    - name: "terminalId"
      type: "long"
      required: true
      description: "Merchant terminal"
      example: "1234"

    - name: "userName"
      type: "string"
      required: true
      description: "Merchant username"
      example: "******"

    - name: "userPassword"
      type: "string"
      required: true
      description: "Merchant password"
      example: "******"

    - name: "orderId"
      type: "long"
      required: true
      description: "Reversal request number"
      example: "14"

    - name: "saleOrderId"
      type: "long"
      required: true
      description: "Purchase request number"
      example: "10"

    - name: "saleReferenceId"
      type: "long"
      required: true
      description: "Purchase transaction reference"
      example: "127926981246"

  response_fields:
    type: "Response code"
    details: "NOT_DOCUMENTED"

  conditions:
    - "Used when payment status is unknown"
    - "Should be called after bpVerifyRequest"
    - "Maximum time for reversal announcement is 3 hours after Verify"
    - "Document also states reversal of deducted amount is possible until end of current day provided settlement has not been requested"
```

### تناقض/ابهام زمانی در Reversal

دو محدودیت در متن وجود دارد:

1. صفحه 20: حداکثر زمان اعلام Reverse برای هر تراکنش **3 ساعت پس از Verify** است.
2. همان بخش: حداکثر زمان برگشت مبلغ کسرشده تا **پایان روز جاری**، مشروط بر اینکه درخواست Settlement داده نشده باشد.

این دو عبارت یکسان نیستند؛ هر دو باید در Adapter/Business Rule لحاظ شوند یا از PSP clarification دریافت شود.

---

## 12.2 Refund — bpRefundRequest

```yaml
refund:
  supported: true
  operation: "bpRefundRequest"
  method: "SOAP operation"
  endpoint: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"

  request_fields:
    - name: "terminalId"
      type: "long"
      required: true
      description: "Merchant terminal"
      example: "1234"

    - name: "userName"
      type: "string"
      required: true
      description: "Merchant username"
      example: "******"

    - name: "userPassword"
      type: "string"
      required: true
      description: "Merchant password"
      example: "******"

    - name: "orderId"
      type: "long"
      required: true
      description: "Refund request number; must be unique per refund call"
      example: "61"

    - name: "saleOrderId"
      type: "long"
      required: true
      description: "Purchase request number"
      example: "10"

    - name: "saleReferenceId"
      type: "long"
      required: true
      description: "Purchase transaction reference"
      example: "127926981246"

    - name: "refundAmount"
      type: "long"
      required: true
      description: "Amount to refund"
      example: "500"

  response_fields:
    type: "Response code"
    details: "NOT_DOCUMENTED"

  conditions:
    - "Original purchase must have been settled"
    - "bpSettleRequest must have been called"
    - "Can be called multiple times for one purchase"
    - "Total refunded amount must not exceed original purchase amount"
    - "orderId must be unique for every refund request"
```

### Timeout / Non-zero Refund Response

مستند صراحتاً می‌گوید اگر `bpRefundRequest` Timeout شود یا Response Code غیر از `0` باشد، پذیرنده باید ابتدا از طریق متدهای Inquiry از ناموفق بودن Refund اطمینان حاصل کند و فقط در صورت ناموفق بودن عملیات، Refund را مجدداً فراخوانی کند.

---

## 12.3 Refund To PAN — bpRefundToPANRequest

```yaml
refund_to_pan:
  supported: true
  operation: "bpRefundToPANRequest"
  method: "SOAP operation"
  endpoint: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"

  request_fields:

    - name: "terminalId"
      type: "long"
      required: true
      description: "Merchant terminal"
      example: "1234"

    - name: "User"
      type: "string"
      required: true
      description: "Username"
      example: "******"

    - name: "Password"
      type: "string"
      required: true
      description: "Password"
      example: "******"

    - name: "PAN"
      type: "long"
      required: "Conditional"
      description: "Destination PAN"
      example: "6104337116619294"

    - name: "SaleReferenceId"
      type: "Long"
      required: "Conditional"
      description: "Purchase transaction whose PAN should be recovered"
      example: "127926981246"

    - name: "Amount"
      type: "long"
      required: true
      description: "Refund amount"
      example: "50000"

    - name: "orderId"
      type: "long"
      required: true
      description: "Refund request number; must be unique per call"
      example: "61"

    - name: "mobileNumber"
      type: "string"
      required: false
      description: "Cardholder mobile number for matching card/mobile information"
      example: "989122222222"

  response_fields:
    - name: "ResponseCode"
      type: "NOT_DOCUMENTED"
      description: "Response code"
      example: NOT_DOCUMENTED

    - name: "ReferenceNumber"
      type: "NOT_DOCUMENTED"
      description: "Reference number"
      example: NOT_DOCUMENTED

  conditions:
    - "PAN and SaleReferenceId are individually optional"
    - "Exactly one of PAN or SaleReferenceId must be present per call"
    - "If PAN is supplied, refund is made to that PAN"
    - "If SaleReferenceId is supplied, refund is made to PAN of that purchase transaction"
    - "Refund amount is deducted from merchant's available credit"
```

---

# 13. وضعیت تراکنش

مستند عملاً Status مستقل جدا از `ResCode` ارائه نمی‌کند و وضعیت‌ها عمدتاً از طریق Response Codeها بیان می‌شوند.

```yaml
transaction_statuses:

  - code: "0"
    name: "SUCCESS"
    meaning: "تراکنش با موفقیت انجام شد"
    successful: true
    final: true
    retry_allowed: false
    source: "Page 28"

  - code: "17"
    name: "CANCELLED_BY_USER"
    meaning: "کاربر از انجام تراکنش منصرف شده است"
    successful: false
    final: true
    retry_allowed: NOT_DOCUMENTED
    source: "Page 28"

  - code: "42"
    name: "SALE_NOT_FOUND"
    meaning: "تراکنش Sale یافت نشد"
    successful: false
    final: true
    retry_allowed: NOT_DOCUMENTED
    source: "Page 29"

  - code: "43"
    name: "ALREADY_VERIFIED"
    meaning: "قبلاً درخواست Verify داده شده است"
    successful: true
    final: true
    retry_allowed: false
    source: "Page 29"

  - code: "44"
    name: "VERIFY_NOT_FOUND"
    meaning: "درخواست Verify یافت نشد"
    successful: false
    final: true
    retry_allowed: NOT_DOCUMENTED
    source: "Page 29"

  - code: "45"
    name: "ALREADY_SETTLED"
    meaning: "تراکنش قبلاً Settle شده است"
    successful: true
    final: true
    retry_allowed: false
    source: "Page 29"

  - code: "46"
    name: "NOT_SETTLED"
    meaning: "تراکنش Settle نشده است"
    successful: false
    final: false
    retry_allowed: NOT_DOCUMENTED
    source: "Page 29"

  - code: "47"
    name: "SETTLE_NOT_FOUND"
    meaning: "تراکنش Settle یافت نشد"
    successful: false
    final: true
    retry_allowed: NOT_DOCUMENTED
    source: "Page 29"

  - code: "48"
    name: "REVERSED"
    meaning: "تراکنش Reverse شده است"
    successful: false
    final: true
    retry_allowed: false
    source: "Page 29"
```

### وضعیت‌های قابل تشخیص

```yaml
payment_success:
  primary_code: "0"

payment_failure:
  codes: "All documented non-zero failure codes unless explicitly described otherwise"

pending_or_unknown:
  explicit_code: NOT_DOCUMENTED
  operational_indicator: "No usable response from Verify / transaction status requires Inquiry"

cancel:
  code: "17"

timeout:
  explicit_status_code: NOT_DOCUMENTED
  documented_behavior:
    verify: "If no Verify within 20 minutes, Auto-Reversal"
    refund: "Timeout requires Inquiry before retry"

duplicate:
  codes:
    - "41"
    - "51"

unknown:
  operational_state: "No response / inability to determine Verify result"
  action: "bpInquiryRequest"

needs_inquiry:
  condition: "No usable response from bpVerifyRequest or bpRefundRequest"
```

---

# 14. Error Codes

```yaml
error_codes:

  - code: "0"
    message: "تراکنش با موفقیت انجام شد"
    meaning: "Success"
    stage: "All relevant operations"
    retryable: false
    action: "Continue according to flow"
    source: "Page 28"

  - code: "11"
    message: "شماره کارت نامعتبر است"
    meaning: "Invalid card number"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "12"
    message: "موجودی کافی نیست"
    meaning: "Insufficient balance"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "13"
    message: "رمز نادرست است"
    meaning: "Incorrect PIN"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "14"
    message: "تعداد دفعات وارد کردن رمز بیش از حد مجاز است"
    meaning: "PIN entry attempts exceeded"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "15"
    message: "کارت نامعتبر است"
    meaning: "Invalid card"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "16"
    message: "دفعات برداشت وجه بیش از حد مجاز است"
    meaning: "Withdrawal attempts exceeded"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "17"
    message: "کاربر از انجام تراکنش منصرف شده است"
    meaning: "User cancelled"
    stage: "Payment"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "18"
    message: "تاریخ انقضای کارت گذشته است"
    meaning: "Expired card"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "19"
    message: "مبلغ برداشت وجه بیش از حد مجاز است"
    meaning: "Withdrawal amount exceeds allowed limit"
    stage: "Payment / Refund"
    retryable: false
    action: "For refund: total requested refunds exceed purchase amount"
    source: "Page 28"

  - code: "111"
    message: "صادر کننده کارت نامعتبر است"
    meaning: "Invalid card issuer"
    stage: "Payment"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "112"
    message: "خطای سوییچ صادر کننده کارت"
    meaning: "Card issuer switch error"
    stage: "Payment"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "113"
    message: "پاسخی از صادرکننده کارت دریافت نشد"
    meaning: "No response from card issuer"
    stage: "Payment"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "114"
    message: "دارنده کارت مجاز به انجام این تراکنش نیست"
    meaning: "Cardholder not authorized"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "21"
    message: "پذیرنده نامعتبر است"
    meaning: "Invalid merchant"
    stage: "Payment/API"
    retryable: false
    action: "Contact به پرداخت"
    source: "Page 28"

  - code: "23"
    message: "خطای امنیتی رخ داده است"
    meaning: "Security error"
    stage: "Payment/API"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "24"
    message: "اطلاعات کاربری پذیرنده نامعتبر است"
    meaning: "Invalid merchant credentials"
    stage: "API"
    retryable: false
    action: "Check credentials"
    source: "Page 28"

  - code: "25"
    message: "مبلغ نامعتبر است"
    meaning: "Invalid amount"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "31"
    message: "پاسخ نامعتبر است"
    meaning: "Invalid response"
    stage: "API"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "32"
    message: "فرمت اطلاعات وارد شده صحیح نمی باشد"
    meaning: "Invalid input format"
    stage: "API"
    retryable: false
    action: "Correct request format"
    source: "Page 28"

  - code: "33"
    message: "حساب نامعتبر است"
    meaning: "Invalid account"
    stage: "API"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "34"
    message: "خطای سیستمی"
    meaning: "System error"
    stage: "API"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "35"
    message: "تاریخ نامعتبر است"
    meaning: "Invalid date"
    stage: "API"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 28"

  - code: "41"
    message: "شماره درخواست تکراری است"
    meaning: "Duplicate request number"
    stage: "API"
    retryable: false
    action: "Use unique orderId where required"
    source: "Page 28"

  - code: "42"
    message: "تراکنش Sale یافت نشد"
    meaning: "Sale transaction not found / unsuccessful for refund"
    stage: "Refund"
    retryable: false
    action: "Original successful purchase is prerequisite for refund"
    source: "Page 29"

  - code: "43"
    message: "قبلاً درخواست Verify داده شده است"
    meaning: "Already verified"
    stage: "Verify"
    retryable: false
    action: "Transaction can be considered successful"
    source: "Page 29"

  - code: "44"
    message: "درخواست Verfiy یافت نشد"
    meaning: "Verify request not found"
    stage: "Verify"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "45"
    message: "تراکنش Settle شده است"
    meaning: "Already settled"
    stage: "Settle"
    retryable: false
    action: "Transaction can be considered successful"
    source: "Page 29"

  - code: "46"
    message: "تراکنش Settle نشده است"
    meaning: "Transaction not settled"
    stage: "Settle"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "47"
    message: "تراکنش Settle یافت نشد"
    meaning: "Settlement transaction not found"
    stage: "Settle"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "48"
    message: "تراکنش Reverse شده است"
    meaning: "Already reversed"
    stage: "Reverse"
    retryable: false
    action: "Funds have been returned"
    source: "Page 29"

  - code: "412"
    message: "شناسه قبض نادرست است"
    meaning: "Invalid bill ID"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "413"
    message: "شناسه پرداخت نادرست است"
    meaning: "Invalid payment ID"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "414"
    message: "سازمان صادر کننده قبض نامعتبر است"
    meaning: "Invalid bill issuer organization"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "415"
    message: "زمان جلسه کاری به پایان رسیده است"
    meaning: "Work session expired"
    stage: "API"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "416"
    message: "خطا در ثبت اطلاعات"
    meaning: "Error registering information"
    stage: "API"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "417"
    message: "شناسه پرداخت کننده نامعتبر است"
    meaning: "Invalid payer ID"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "418"
    message: "اشکال در تعریف اطلاعات مشتری"
    meaning: "Problem defining customer information"
    stage: "Payment"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "419"
    message: "تعداد دفعات ورود اطلاعات از حد مجاز گذشته است"
    meaning: "Input attempts exceeded"
    stage: "Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "421"
    message: "IP نامعتبر است"
    meaning: "Invalid/unregistered merchant server IP"
    stage: "API"
    retryable: false
    action: "Register merchant server IP with به پرداخت"
    source: "Page 29"

  - code: "51"
    message: "تراکنش تکراری است"
    meaning: "Duplicate transaction"
    stage: "API/Payment"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "54"
    message: "تراکنش مرجع موجود نیست"
    meaning: "Reference transaction does not exist"
    stage: "API"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "55"
    message: "تراکنش نامعتبر است"
    meaning: "Invalid transaction"
    stage: "API"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "61"
    message: "خطا در واریز"
    meaning: "Settlement/deposit error"
    stage: "Settle"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 29"

  - code: "62"
    message: "مسیر بازگشت به سایت در دامنه ثبت شده برای پذیرنده قرار ندارد"
    meaning: "Callback path is outside registered merchant domain"
    stage: "Callback/Payment"
    retryable: false
    action: "Use callback URL under registered domain; contact به پرداخت to change registered domain"
    source: "Page 30"

  - code: "98"
    message: "سقف استفاده از رمز ایستا به پایان رسیده است"
    meaning: "Static password usage limit reached"
    stage: "Payment"
    retryable: NOT_DOCUMENTED
    action: NOT_DOCUMENTED
    source: "Page 30"

  - code: "995"
    message: "تعلق کارت بانکی به مشتری احراز نشد"
    meaning: "Bank card ownership could not be verified for customer"
    stage: "Payment / Identity verification"
    retryable: false
    action: NOT_DOCUMENTED
    source: "Page 30"
```

---

# 15. Transaction IDها

```yaml
identifiers:

  - name: "terminalId"
    type: "long"
    generated_by: "PSP / Merchant onboarding"
    generated_when: "Merchant registration"
    used_for: "Authentication and identifying merchant terminal"
    required_for_verify: true
    required_for_settlement: true

  - name: "orderId"
    type: "long"
    generated_by: "Merchant"
    generated_when: "Each API request"
    used_for: "Identifying merchant request"
    required_for_verify: true
    required_for_settlement: true

  - name: "SaleOrderId"
    type: "long"
    generated_by: "Merchant"
    generated_when: "Payment request"
    used_for: "Purchase transaction identifier after Sale"
    required_for_verify: true
    required_for_settlement: true

  - name: "saleOrderId"
    type: "long"
    generated_by: "Merchant"
    generated_when: "Payment request"
    used_for: "Verify/Settle/Inquiry/Reverse/Refund"
    required_for_verify: true
    required_for_settlement: true

  - name: "SaleReferenceId"
    type: "long"
    generated_by: "Mellat"
    generated_when: "After Sale/payment"
    used_for: "Referencing purchase transaction"
    required_for_verify: true
    required_for_settlement: true

  - name: "RefId"
    type: "string"
    generated_by: "Mellat"
    generated_when: "Successful bpPayRequest / payment creation"
    used_for: "Redirect to payment page and callback correlation"
    required_for_verify: false
    required_for_settlement: false

  - name: "subServiceId"
    type: "long"
    generated_by: "Mellat / merchant setup"
    generated_when: "Merchant definition for Type 2 payment"
    used_for: "Dynamic payment destination account"
    required_for_verify: "NOT_DOCUMENTED separately"
    required_for_settlement: "NOT_DOCUMENTED separately"
```

### تفاوت Identifierها

```yaml
identifier_semantics:
  orderId:
    meaning: "شناسه درخواست ارسالی از پذیرنده"
    uniqueness:
      bpPayRequest: "must be unique"
      bpDynamicPayRequest: "must be unique"
      bpCumulativeDynamicPayRequest: "must be unique"
      bpRefundRequest: "must be unique per refund call"
      bpRefundToPANRequest: "must be unique per refund call"
      bpVerifyRequest: "uniqueness not mandatory"
      bpSettleRequest: "uniqueness not mandatory"
      bpInquiryRequest: "uniqueness not mandatory"
      bpReversalRequest: "uniqueness not mandatory"

  SaleOrderId:
    meaning: "Purchase request number; document states orderId of Sale becomes SaleOrderId after successful Verify"

  SaleReferenceId:
    meaning: "Gateway-provided purchase transaction reference"

  RefId:
    meaning: "Hashcode generated by payment request and used for Redirect/callback correlation"

  Token:
    value: "NOT_DOCUMENTED as token terminology"
```

---

# 16. مبلغ

```yaml
amount:
  unit: NOT_DOCUMENTED
  currency: NOT_DOCUMENTED
  type: "long"
  min: NOT_DOCUMENTED
  max: NOT_DOCUMENTED
  decimal_allowed: false
  conversion_required: NOT_DOCUMENTED
  notes:
    - "Document calls the field amount / مبلغ خرید"
    - "The provided documentation does not explicitly state Rial or Toman"
```

**نکته مهم:** با وجود اینکه این درگاه ایرانی است، از متن ارائه‌شده نمی‌توان با قطعیت نتیجه گرفت `amount` ریال است یا تومان. بنابراین مقدار واحد عمداً `NOT_DOCUMENTED` باقی می‌ماند.

برای تراکنش کالای ایرانی، مستند الزام می‌کند مجموع مبلغ اقلام با `Amount` ورودی Web Service برابر باشد.

منبع: صفحات 13 و 17.

---

# 17. امنیت

```yaml
security:
  tls: "HTTPS endpoint is documented; TLS version NOT_DOCUMENTED"
  certificate: NOT_DOCUMENTED
  authentication: "terminalId + userName + userPassword"
  signature: NOT_DOCUMENTED
  encryption:
    encPan:
      algorithm: "DES/ECB/NoPadding"
      key: "2C7D202B960A96AA"
    enc_strong_auth:
      algorithm: "DES/ECB/PKCS5Padding"
      key: "2C7D202B960A96AA"
    mana_identity_verification:
      algorithm: "Uses mutually agreed encryption key between merchant and Shaparak"
      key: "REQUIRED_FROM_PSP"
  hashing:
    RefId:
      description: "Hashcode according to document terminology"
      algorithm: NOT_DOCUMENTED
  ip_whitelist:
    required: true
    value: "Merchant server IP must be registered"
  nonce: NOT_DOCUMENTED
  timestamp: NOT_DOCUMENTED
  replay_protection: NOT_DOCUMENTED
  referer_validation:
    required: true
    description: "Referer header must contain merchant registered Domain"
  callback_domain_validation:
    required: true
    description: "callBackUrl must be under registered merchant domain"
```

### Encryption — EncPan

```yaml
algorithm:
  name: "DES/ECB/NoPadding"
  input: "PAN represented as hex bytes according to sample code"
  output: "hex string"
  encoding: "hex"
  key: "2C7D202B960A96AA"
  concatenation_order: "NOT_APPLICABLE"
  padding: "NoPadding"
  source: "Page 14"
```

### Encryption — ENC / Strong Authentication

```yaml
algorithm:
  name: "DES/ECB/PKCS5Padding"
  input: "NationalCode"
  output: "hex string"
  encoding: "hex"
  key: "2C7D202B960A96AA"
  concatenation_order: "NOT_APPLICABLE"
  padding: "PKCS5Padding"
  source: "Page 15"
```

### Mana Identity Verification

```yaml
algorithm:
  name: NOT_DOCUMENTED
  input: "Cardholder National Code"
  output: "Encrypted National Code"
  encoding: NOT_DOCUMENTED
  concatenation_order: NOT_DOCUMENTED
  key: REQUIRED_FROM_PSP
  source: "Page 15"
```

---

# 18. Timeout و Retry

```yaml
timeouts:
  connect: NOT_DOCUMENTED
  read: NOT_DOCUMENTED
  payment: NOT_DOCUMENTED
  callback: NOT_DOCUMENTED
  verify:
    maximum: "20 minutes"
    behavior: "Auto-Reversal if Verify is not requested"
  reversal:
    documented_window: "3 hours after Verify"
    additional_statement: "until end of current day provided settlement request has not been made"
  session:
    minimum: "15 minutes"
    scope: "Merchant web-site session if Session is used"

retry_policy:
  allowed: true
  operations:
    - "bpVerifyRequest"
    - "bpRefundRequest"
    - "Payment creation after non-zero ResCode"
  conditions:
    bpPayRequest: "If non-zero response, invoke again for a new RefId according to document"
    bpVerifyRequest: "If ResCode is not 0, call again until appropriate response such as success/already verified/already reversed"
    bpRefundRequest: "On timeout/non-zero response, first use inquiry to establish refund failure; retry only if refund is confirmed unsuccessful"
  max_attempts: NOT_DOCUMENTED
  delay: NOT_DOCUMENTED
```

---

# 19. Idempotency و Duplicate Payment

```yaml
idempotency:
  supported: "Partially documented through request-number uniqueness"
  mechanism: "Unique orderId for specified operations"
  required_field: "orderId"
  duplicate_behavior:
    codes:
      - "41"
      - "51"
    description:
      - "41: شماره درخواست تکراری است"
      - "51: تراکنش تکراری است"
  notes:
    - "bpPayRequest orderId must be unique"
    - "bpDynamicPayRequest orderId must be unique"
    - "bpCumulativeDynamicPayRequest orderId must be unique"
    - "bpRefundRequest orderId must be unique per refund call"
    - "bpRefundToPANRequest orderId must be unique per refund call"
    - "Verify/Settle/Inquiry/Reversal orderId uniqueness is explicitly not mandatory"
```

---

# 20. Sandbox / Test Environment

```yaml
sandbox:
  available: true
  base_url: NOT_DOCUMENTED
  wsdl: NOT_DOCUMENTED
  credentials: REQUIRED_FROM_PSP
  test_cards: NOT_DOCUMENTED
  test_amounts: NOT_DOCUMENTED
  test_scenarios: NOT_DOCUMENTED
  payment_identifier:
    value: "0"
    note: "Document explicitly says payment identifier must be zero in test environment"
```

**نکته:** مستند تاریخچه به «آدرس سرورهای تستی» اشاره می‌کند، اما در متن ارائه‌شده آدرس تستی فعلی نسخه 1.29 درج نشده است. بنابراین نباید URL تست را حدس زد.

---

# 21. Production Environment

```yaml
production:
  base_url: "https://bpm.shaparak.ir"
  wsdl: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"
  payment_url:
    persian: "https://bpm.shaparak.ir/pgwchannel/startpay.mellat"
    english: "https://bpm.shaparak.ir/pgwchannel/enstartpay.mellat"
    iranian_goods_credit: "https://bpm.shaparak.ir/pgwCreditchannel/startpay.mellat"
  callback_requirements:
    - "callBackUrl must be under registered merchant domain"
    - "Referer header must contain registered Domain/SubDomain"
  ip_requirements:
    - "Merchant server IP must be registered with به پرداخت"
```

---

# 22. نمونه Request و Response

## Create Payment — SOAP

مستند ارائه‌شده XML Envelope واقعی SOAP را ارائه نمی‌کند؛ فقط Signature عملیات و پارامترها را مشخص می‌کند.

```http
REQUEST
SOAP Operation: bpPayRequest

terminalId    = 1234
userName      = "******"
userPassword  = "******"
orderId       = 10
amount        = 1
localDate     = "20091008"
localTime     = "102003"
additionalData = NOT_DOCUMENTED
callBackUrl   = "http://www.mysite.com/myfolder/callbackmellat.aspx"
payerId       = "0"
mobileNo      = NOT_DOCUMENTED
encPan        = NOT_DOCUMENTED
panHiddenMode = NOT_DOCUMENTED
cartItem      = NOT_DOCUMENTED
enc           = NOT_DOCUMENTED
```

```http
RESPONSE

0, AF82041a2Bf6989c7fF9
```

Interpretation:

```yaml
ResCode: "0"
RefId: "AF82041a2Bf6989c7fF9"
```

منبع: صفحات 12–13.

---

## Redirect

```http
POST https://bpm.shaparak.ir/pgwchannel/startpay.mellat
Referer: <merchant registered Domain>
Content-Type: application/x-www-form-urlencoded

RefId=AF82041a2Bf6989c7fF9
```

نمونه مستند:

```html
<form name="input"
      action="https://bpm.shaparak.ir/pgwchannel/startpay.mellat"
      method="post"
      target="_blank">
    <input type="text" id="RefId" name="RefId" />
    <input type="submit" value="Submit" />
</form>
```

---

## Callback

```http
POST <Merchant callBackUrl>

RefId=AF82041a2Bf6989c7fF9
ResCode=0
SaleOrderId=10
SaleReferenceId=127926981246
CardHolderPan=610433*****5689
CreditCardSaleResponseDetail=NOT_DOCUMENTED
FinalAmount=NOT_DOCUMENTED
```

مقادیر فوق به‌جز مثال‌های صریح مستند، صرفاً نمایش ساختار هستند و نباید به‌عنوان مقادیر واقعی فرض شوند.

---

## Verify

```http
REQUEST
SOAP Operation: bpVerifyRequest

terminalId      = 1234
userName        = "******"
userPassword    = "******"
orderId         = 11
saleOrderId     = 10
saleReferenceId = 127926981246
```

```http
RESPONSE

0
```

---

## Settle

```http
REQUEST
SOAP Operation: bpSettleRequest

terminalId      = 1234
userName        = "******"
userPassword    = "******"
orderId         = 21
saleOrderId     = 10
saleReferenceId = 127926981246
```

```http
RESPONSE

0
```

---

# 23. داده‌های موردنیاز برای ساخت Adapter

```yaml
payment_gateway_adapter:
  provider: "به پرداخت ملت"
  protocol: "SOAP"
  create_payment:
    operation: "bpPayRequest"
    alternative: "bpChargePayRequest"

  redirect:
    method: "POST"
    url: "https://bpm.shaparak.ir/pgwchannel/startpay.mellat"
    token: "RefId"

  callback:
    method: "POST"
    target: "Merchant callBackUrl"

  verify:
    operation: "bpVerifyRequest"
    required: true

  settle:
    operation: "bpSettleRequest"
    required: true

  inquiry:
    operation: "bpInquiryRequest"

  reverse:
    operation: "bpReversalRequest"

  refund:
    operation: "bpRefundRequest"

  refund_to_pan:
    operation: "bpRefundToPANRequest"

  required_config:
    - name: "terminalId"
      description: "Merchant internet terminal number"
      source: "PSP"

    - name: "userName"
      description: "Merchant internet username"
      source: "PSP"

    - name: "userPassword"
      description: "Merchant password"
      source: "PSP"

    - name: "merchant_server_ip"
      description: "Server IP registered with PSP"
      source: "PSP"

    - name: "registered_domain"
      description: "Domain/SubDomain used for callback and Referer validation"
      source: "PSP"

    - name: "callback_url"
      description: "Merchant callback URL under registered domain"
      source: "Merchant"

    - name: "subServiceId"
      description: "Dynamic payment destination account identifier"
      source: "PSP"
      condition: "Type 2 payments only"

  transaction_fields:
    order_id: "orderId"
    amount: "amount"
    token: "RefId"
    transaction_id: "SaleOrderId / saleReferenceId depending on context"
    reference_id: "SaleReferenceId"
    tracking_id: "NOT_DOCUMENTED as a separate field"
    callback_status: "ResCode"

  success_definition:
    payment_page: "ResCode == 0 from payment request and valid RefId"
    callback: "ResCode == 0 plus matching RefId/SaleOrderId"
    verify: "Response code == 0 or documented already-verified state 43"
    settle: "Response == 0"
  
  failure_definition:
    payment: "Non-zero ResCode"
    callback: "Non-zero ResCode or RefId/SaleOrderId mismatch"
    verify: "Documented non-success response codes"
    settle: "Response code other than 0"
```

---

# 24. API Contract نهایی

```text
CONFIG
------
terminalId              REQUIRED_FROM_PSP
userName                REQUIRED_FROM_PSP
userPassword            REQUIRED_FROM_PSP
merchant_server_ip      REQUIRED_FROM_PSP
registered_domain       REQUIRED_FROM_PSP
callback_url             REQUIRED_FROM_MERCHANT
subServiceId             REQUIRED_FROM_PSP for Type-2 payment


ENDPOINTS
---------
SOAP:
https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl

Persian Payment:
https://bpm.shaparak.ir/pgwchannel/startpay.mellat

English Payment:
https://bpm.shaparak.ir/pgwchannel/enstartpay.mellat

Iranian Goods Credit:
https://bpm.shaparak.ir/pgwCreditchannel/startpay.mellat


AUTHENTICATION
--------------
terminalId
userName
userPassword

Additional network authorization:
registered merchant server IP


CREATE PAYMENT
--------------
Operation:
bpPayRequest

Required:
terminalId
userName
userPassword
orderId
amount
localDate
localTime
additionalData
callBackUrl
payerId

Optional:
mobileNo
encPan
panHiddenMode
cartItem
enc

Response:
ResCode, RefId

Success:
ResCode == 0


REDIRECT
--------
POST RefId to:

https://bpm.shaparak.ir/pgwchannel/startpay.mellat

Referer header is required and must match registered Domain/SubDomain.


CALLBACK
--------
POST to callBackUrl

Fields:
RefId
ResCode
SaleOrderId
SaleReferenceId
CardHolderPan
CreditCardSaleResponseDetail
FinalAmount

Before Verify:
Validate RefId
Validate SaleOrderId

Mismatch:
Transaction invalid
Do NOT Verify


VERIFY
------
Operation:
bpVerifyRequest

Required:
terminalId
userName
userPassword
orderId
saleOrderId
saleReferenceId

Success:
Response code == 0

Previously verified:
43

Deadline:
20 minutes

If Verify is not requested:
Auto-Reversal


SETTLE
------
Operation:
bpSettleRequest

Required:
terminalId
userName
userPassword
orderId
saleOrderId
saleReferenceId

Success:
0


INQUIRY
-------
Operation:
bpInquiryRequest

Used when:
Verify result is not received / status cannot be determined

Required:
terminalId
userName
userPassword
orderId
saleOrderId
saleReferenceId


REVERSE
-------
Operation:
bpReversalRequest

Used:
When payment status remains unknown after Inquiry

Must:
Follow bpVerifyRequest

Documented timing:
3 hours after Verify
AND a separate statement says until end of current day if settlement has not been requested.

This timing requires PSP clarification.


REFUND
------
Operation:
bpRefundRequest

Precondition:
Purchase must have been settled.

Fields:
terminalId
userName
userPassword
orderId
saleOrderId
saleReferenceId
refundAmount

Multiple refunds:
Allowed

Constraint:
Total refunds <= original purchase amount

orderId:
Unique per refund request


REFUND TO PAN
-------------
Operation:
bpRefundToPANRequest

Fields:
terminalId
User
Password
PAN [optional]
SaleReferenceId [optional]
Amount
orderId
mobileNumber [optional]

Exactly one:
PAN OR SaleReferenceId

Response:
ResponseCode
ReferenceNumber


STATUS MAPPING
--------------
0   SUCCESS
17  USER_CANCELLED
42  SALE_NOT_FOUND
43  ALREADY_VERIFIED
44  VERIFY_NOT_FOUND
45  ALREADY_SETTLED
46  NOT_SETTLED
47  SETTLE_NOT_FOUND
48  REVERSED

No explicit generic PENDING status is documented.


ERROR MAPPING
-------------
11  Invalid card number
12  Insufficient balance
13  Incorrect PIN
14  PIN attempts exceeded
15  Invalid card
16  Withdrawal attempts exceeded
17  User cancelled
18  Card expired
19  Amount exceeds allowed limit
21  Invalid merchant
23  Security error
24  Invalid merchant credentials
25  Invalid amount
31  Invalid response
32  Invalid input format
33  Invalid account
34  System error
35  Invalid date
41  Duplicate request number
42  Sale transaction not found
43  Already verified
44  Verify request not found
45  Already settled
46  Not settled
47  Settlement not found
48  Reversed
51  Duplicate transaction
54  Reference transaction not found
55  Invalid transaction
61  Settlement/deposit error
62  Callback outside registered domain
98  Static password usage limit reached
111 Invalid card issuer
112 Card issuer switch error
113 No response from card issuer
114 Cardholder not authorized
412 Invalid bill ID
413 Invalid payment ID
414 Invalid bill issuer organization
415 Work session expired
416 Error registering information
417 Invalid payer ID
418 Customer information definition error
419 Input attempts exceeded
421 Invalid/unregistered merchant IP
995 Card ownership not verified


TRANSACTION IDENTIFIERS
-----------------------
Merchant request:
orderId

Purchase request:
SaleOrderId / saleOrderId

Gateway transaction reference:
SaleReferenceId / saleReferenceId

Payment redirect reference:
RefId

Dynamic payment destination:
subServiceId


AMOUNT/CURRENCY
---------------
Type:
long

Unit:
NOT_DOCUMENTED

Currency:
NOT_DOCUMENTED

Do not assume Rial or Toman.


SECURITY
--------
SOAP credentials:
terminalId + userName + userPassword

IP registration:
Required

Callback domain:
Required

Redirect Referer:
Required

EncPan:
DES/ECB/NoPadding
Key: 2C7D202B960A96AA

Strong authentication ENC:
DES/ECB/PKCS5Padding
Key: 2C7D202B960A96AA

Mana identity verification:
Encryption key = REQUIRED_FROM_PSP
Algorithm = NOT_DOCUMENTED in provided text


TIMEOUT
-------
Verify:
20 minutes

Session:
At least 15 minutes if merchant uses session

Other network/application timeouts:
NOT_DOCUMENTED


RETRY
-----
Verify:
Retry documented

Refund:
Inquiry before retry after timeout/non-zero response

Payment:
New RefId should be obtained after failed payment request

Max attempts:
NOT_DOCUMENTED

Delay:
NOT_DOCUMENTED


SANDBOX
-------
Existence of test environment:
Historical documentation mentions test servers.

Current v1.29 test URL:
NOT_DOCUMENTED

Test WSDL:
NOT_DOCUMENTED

Test credentials:
REQUIRED_FROM_PSP

Test cards:
NOT_DOCUMENTED

Test amount:
NOT_DOCUMENTED

Payment identifier in test:
0


PRODUCTION
----------
SOAP WSDL:
https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl

Persian Payment:
https://bpm.shaparak.ir/pgwchannel/startpay.mellat

English Payment:
https://bpm.shaparak.ir/pgwchannel/enstartpay.mellat

Iranian Goods:
https://bpm.shaparak.ir/pgwCreditchannel/startpay.mellat
```

---

# 25. MISSING_OR_AMBIGUOUS_INFORMATION

```yaml
MISSING_OR_AMBIGUOUS_INFORMATION:

  - item: "SOAP Namespace"
    why_required: "برای ساخت SOAP client دقیق"
    found_in_document: "WSDL URL only"
    status: "NOT_DOCUMENTED"
    recommendation: "Extract from actual WSDL or obtain from PSP"

  - item: "SOAP Service name"
    why_required: "برای binding/client generation"
    found_in_document: "Not present in supplied text"
    status: "NOT_DOCUMENTED"
    recommendation: "Extract from actual WSDL"

  - item: "SOAP Port name"
    why_required: "برای اتصال به SOAP endpoint"
    found_in_document: "Not present"
    status: "NOT_DOCUMENTED"
    recommendation: "Extract from actual WSDL"

  - item: "SOAP operation XML signature"
    why_required: "برای تولید دقیق SOAP Envelope"
    found_in_document: "Method names and parameters only"
    status: "PARTIALLY_DOCUMENTED"
    recommendation: "Use actual WSDL"

  - item: "SOAP HTTP Content-Type"
    why_required: "HTTP client configuration"
    found_in_document: "SOAP/XML described, no HTTP Content-Type header"
    status: "NOT_DOCUMENTED"
    recommendation: "Obtain from WSDL/client interoperability documentation"

  - item: "TLS version"
    why_required: "Production security configuration"
    found_in_document: "HTTPS URL exists"
    status: "NOT_DOCUMENTED"
    recommendation: "Confirm supported TLS versions with PSP"

  - item: "Amount unit"
    why_required: "Critical financial correctness"
    found_in_document: "Only amount field and examples"
    status: "NOT_DOCUMENTED"
    recommendation: "Explicitly confirm Rial vs Toman with PSP"

  - item: "Currency"
    why_required: "Financial contract"
    found_in_document: "Not specified"
    status: "NOT_DOCUMENTED"
    recommendation: "Obtain from PSP"

  - item: "Amount minimum/maximum"
    why_required: "Validation"
    found_in_document: "Not specified"
    status: "NOT_DOCUMENTED"
    recommendation: "Obtain transaction limits from PSP"

  - item: "Connect timeout"
    why_required: "HTTP/SOAP client configuration"
    found_in_document: "Not specified"
    status: "NOT_DOCUMENTED"
    recommendation: "Define operational timeout with PSP/production experience"

  - item: "Read timeout"
    why_required: "HTTP/SOAP client configuration"
    found_in_document: "Not specified"
    status: "NOT_DOCUMENTED"
    recommendation: "Obtain operational recommendation"

  - item: "Callback timeout"
    why_required: "Merchant server behavior"
    found_in_document: "Not specified"
    status: "NOT_DOCUMENTED"
    recommendation: "Obtain from PSP"

  - item: "Maximum retry count"
    why_required: "Avoid duplicate financial operations"
    found_in_document: "Retry cases described but no max count"
    status: "NOT_DOCUMENTED"
    recommendation: "Implement operation-specific state machine; obtain official retry limit"

  - item: "Retry delay"
    why_required: "Retry control"
    found_in_document: "Not specified"
    status: "NOT_DOCUMENTED"
    recommendation: "Obtain from PSP"

  - item: "Inquiry response schema"
    why_required: "Exact status mapping"
    found_in_document: "Function and purpose described, field-level response schema absent"
    status: "NOT_DOCUMENTED"
    recommendation: "Obtain SOAP response contract from WSDL"

  - item: "Reversal response schema"
    why_required: "Exact adapter implementation"
    found_in_document: "Only operation inputs and response-code concept"
    status: "NOT_DOCUMENTED"
    recommendation: "Extract from WSDL"

  - item: "Refund response schema"
    why_required: "Exact refund adapter implementation"
    found_in_document: "Response code referenced indirectly"
    status: "NOT_DOCUMENTED"
    recommendation: "Extract from WSDL"

  - item: "RefundToPAN exact field types for ResponseCode and ReferenceNumber"
    why_required: "Typed implementation"
    found_in_document: "Names only"
    status: "NOT_DOCUMENTED"
    recommendation: "Extract from WSDL"

  - item: "Current test/sandbox WSDL URL"
    why_required: "Testing"
    found_in_document: "Historical mention of test server addresses, current URL absent"
    status: "NOT_DOCUMENTED"
    recommendation: "Obtain current test WSDL from PSP"

  - item: "Test credentials"
    why_required: "Testing"
    found_in_document: "Not supplied"
    status: "REQUIRED_FROM_PSP"
    recommendation: "Request test terminal/user/password"

  - item: "Test cards"
    why_required: "End-to-end testing"
    found_in_document: "Not supplied"
    status: "NOT_DOCUMENTED"
    recommendation: "Obtain official test cards/scenarios"

  - item: "Mana encryption algorithm"
    why_required: "Implementation of National Code encryption"
    found_in_document: "Mutually agreed encryption key mentioned, algorithm not given"
    status: "NOT_DOCUMENTED"
    recommendation: "Obtain algorithm, mode, padding, encoding and exact key from PSP/Shaparak"

  - item: "Mana encryption key"
    why_required: "Encryption implementation"
    found_in_document: "Mutually agreed key"
    status: "REQUIRED_FROM_PSP"
    recommendation: "Obtain provisioning procedure and key securely"

  - item: "RefId generation/hash algorithm"
    why_required: "Correlation/debugging and validation"
    found_in_document: "Called Hashcode"
    status: "NOT_DOCUMENTED"
    recommendation: "Do not implement/generate locally; treat RefId as gateway-generated opaque value"

  - item: "Explicit Pending status code"
    why_required: "State machine"
    found_in_document: "No explicit Pending code"
    status: "NOT_DOCUMENTED"
    recommendation: "Use Inquiry for unknown state as documented"

  - item: "Exact meaning of code 61 across operations"
    why_required: "Operation-specific error handling"
    found_in_document: "Error in deposit/settlement"
    status: "PARTIALLY_DOCUMENTED"
    recommendation: "Map primarily to Settle unless WSDL/API-specific documentation states otherwise"

  - item: "Reversal timing"
    why_required: "Financial recovery policy"
    found_in_document: "Both 3 hours after Verify and end-of-day-before-settlement statements"
    status: "AMBIGUOUS / CONTRADICTORY"
    recommendation: "Obtain explicit current rule from PSP"

  - item: "Refund Inquiry operation mapping"
    why_required: "Retry-safe refund implementation"
    found_in_document: "Document says use transaction inquiry methods"
    status: "AMBIGUOUS"
    recommendation: "Confirm which inquiry operation/status identifies refund outcome"

  - item: "Production IP whitelist procedure"
    why_required: "Network onboarding"
    found_in_document: "IP must be registered"
    status: "PARTIALLY_DOCUMENTED"
    recommendation: "Obtain exact registration/change procedure"

  - item: "Registered Domain/SubDomain provisioning procedure"
    why_required: "Callback/Referer validation"
    found_in_document: "Domain/SubDomain must be registered"
    status: "PARTIALLY_DOCUMENTED"
    recommendation: "Obtain exact onboarding/change process"
```

---

# 26. Source Mapping

```yaml
sources:

  - information: "Documentation identity and version"
    document: "راهنمای کاربران: شرح توابع و متدهای دروازه پرداخت اینترنتی بانک ملت"
    page: "1-6"
    section: "Title / Revision History / Table of Contents"
    quote_or_reference: "نگارش 1.29 — تیرماه 1402"

  - information: "SOAP/Web Service architecture"
    document: "Same"
    page: "7"
    section: "1. مقدمه"
    quote_or_reference: "Web Services; SOAP; XML; HTTP/HTTPS"

  - information: "Operational WSDL"
    document: "Same"
    page: "10"
    section: "2.2 نحوه استفاده از Web Service"
    quote_or_reference: "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl"

  - information: "Merchant IP registration and credentials"
    document: "Same"
    page: "10"
    section: "2.1 پیش نیازها"
    quote_or_reference: "IP server must be announced; terminal/user/password obtained from company"

  - information: "Main payment operations"
    document: "Same"
    page: "11"
    section: "2.2 نحوه استفاده از Web Service"
    quote_or_reference: "bpPayRequest / bpChargePayRequest; bpVerifyRequest; bpSettleRequest"

  - information: "Payment Page URLs"
    document: "Same"
    page: "12"
    section: "2.3.1 bpPayRequest / bpChargePayRequest"
    quote_or_reference: "Persian, English and Iranian goods payment URLs"

  - information: "bpPayRequest request fields"
    document: "Same"
    page: "13"
    section: "2.3.1"
    quote_or_reference: "Table 1"

  - information: "MobileNo/Profile Id behavior"
    document: "Same"
    page: "13"
    section: "2.3.1"
    quote_or_reference: "12-digit Profile Id and stored cards"

  - information: "EncPan algorithm/key"
    document: "Same"
    page: "14"
    section: "2.3.1"
    quote_or_reference: "DES/ECB/NoPadding; key 2C7D202B960A96AA"

  - information: "HiddenMode behavior"
    document: "Same"
    page: "14"
    section: "2.3.1"
    quote_or_reference: "0 full PAN, 1 last four digits"

  - information: "National Code encryption / strong authentication"
    document: "Same"
    page: "15"
    section: "2.3.1"
    quote_or_reference: "ENC; DES/ECB/PKCS5Padding for strong authentication"

  - information: "MerchantName / merchantAddress"
    document: "Same"
    page: "15"
    section: "2.3.1"
    quote_or_reference: "Optional POST parameters for payment page"

  - information: "Referer validation"
    document: "Same"
    page: "16"
    section: "2.3.1"
    quote_or_reference: "Referer header must contain registered merchant Domain"

  - information: "Iranian goods additionalData format"
    document: "Same"
    pages: "16-17"
    section: "2.3.1"
    quote_or_reference: "999000050... item format"

  - information: "bpVerifyRequest"
    document: "Same"
    pages: "17-18"
    section: "2.3.2"
    quote_or_reference: "Table 2"

  - information: "20-minute Verify deadline / Auto-Reversal"
    document: "Same"
    page: "18"
    section: "2.3.2"
    quote_or_reference: "20 minutes; automatic reversal"

  - information: "bpSettleRequest"
    document: "Same"
    page: "19"
    section: "2.3.3"
    quote_or_reference: "Table 3"

  - information: "bpInquiryRequest"
    document: "Same"
    pages: "19-20"
    section: "2.3.4"
    quote_or_reference: "Table 4 and Inquiry usage"

  - information: "bpReversalRequest"
    document: "Same"
    pages: "20-21"
    section: "2.3.5"
    quote_or_reference: "Table 5 and reversal timing notes"

  - information: "bpRefundRequest"
    document: "Same"
    pages: "21-22"
    section: "2.3.6"
    quote_or_reference: "Table 6 and refund constraints"

  - information: "bpRefundToPANRequest"
    document: "Same"
    pages: "22-23"
    section: "2.3.7"
    quote_or_reference: "Table 7; PAN/SaleReferenceId conditionality"

  - information: "bpDynamicPayRequest"
    document: "Same"
    pages: "23-24"
    section: "2.3.8"
    quote_or_reference: "Table 8"

  - information: "bpCumulativeDynamicPayRequest"
    document: "Same"
    pages: "25-26"
    section: "2.3.9"
    quote_or_reference: "Table 9"

  - information: "Callback fields"
    document: "Same"
    pages: "26-27"
    section: "2.4"
    quote_or_reference: "Table 10"

  - information: "Callback security validation"
    document: "Same"
    page: "27"
    section: "2.4"
    quote_or_reference: "RefId and SaleOrderId must match original transaction"

  - information: "Response/Error codes"
    document: "Same"
    pages: "28-30"
    section: "2.5"
    quote_or_reference: "Table 11"

  - information: "Documentation revision 1.29"
    document: "Same"
    page: "5"
    section: "Revision History"
    quote_or_reference: "به‌روزرسانی سرویس پرداخت مبلغ شارژ تلفن همراه"
```

---

# Adapter Implementation Notes

```yaml
implementation_critical_rules:

  - "Treat RefId as opaque and case-sensitive."

  - "Never generate or modify RefId."

  - "After callback, validate RefId against the payment request that created the transaction."

  - "Validate SaleOrderId against the original orderId."

  - "If RefId or SaleOrderId does not match, do not call bpVerifyRequest."

  - "A successful payment-page callback is not by itself the final merchant-side success condition; bpVerifyRequest is required."

  - "After successful Verify, call bpSettleRequest according to the documented main flow."

  - "If Verify response is unavailable, use bpInquiryRequest."

  - "If status remains unknown after Inquiry, use bpReversalRequest according to documented conditions."

  - "Do not retry financial operations blindly after timeout."

  - "For bpRefundRequest timeout/non-zero response, inquire before retrying."

  - "For bpRefundRequest, total refund amount must not exceed original purchase amount."

  - "For bpRefundRequest and bpRefundToPANRequest, refund orderId must be unique."

  - "For bpPayRequest, bpDynamicPayRequest and bpCumulativeDynamicPayRequest, payment orderId must be unique."

  - "Do not assume amount is Rial or Toman from this document."

  - "Do not assume a SOAP namespace/service/port without reading the actual WSDL."

  - "Use exact parameter capitalization documented by PSP; the document explicitly states that case and formatting matter."

  - "Merchant callback must belong to the registered merchant domain."

  - "Redirect Referer must match registered Domain/SubDomain."

  - "Merchant server IP must be registered with PSP."

  - "If merchant uses application Session, minimum Session Timeout should be 15 minutes according to document."
```

## نتیجه فنی

برای یک Adapter استاندارد، **هسته پرداخت اینترنتی این PSP** به‌صورت زیر است:

```text
bpPayRequest
      ↓
ResCode == 0
      ↓
RefId
      ↓
POST RefId + Referer
      ↓
Mellat Payment Page
      ↓
Merchant Callback
      ↓
Validate RefId + SaleOrderId
      ↓
ResCode == 0
      ↓
bpVerifyRequest
      ↓
Verify Success / Already Verified
      ↓
bpSettleRequest
      ↓
Settlement
```

و مسیر recovery:

```text
Verify response unavailable
        ↓
bpInquiryRequest
        ↓
status determined
   ┌────┴────┐
 success   unknown
             ↓
      bpReversalRequest
```

برای پیاده‌سازی production، مهم‌ترین اطلاعاتی که **هنوز از مستند ارائه‌شده قابل استخراج نیستند** عبارت‌اند از: **SOAP Namespace/Service/Port و Signature دقیق WSDL، واحد مبلغ (ریال/تومان)، مشخصات فعلی Sandbox، الگوریتم دقیق احراز هویت مانا، Timeoutهای شبکه، و جزئیات کامل Response عملیات Inquiry/Refund/Reversal**. این موارد نباید از سایر پیاده‌سازی‌های Mellat یا PSPهای دیگر حدس زده شوند.