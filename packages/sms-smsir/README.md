# @amirhossein-moloki/sms-smsir

SMS.ir provider integration for `@amirhossein-moloki/sms-core`.

## Installation

```bash
pnpm add @amirhossein-moloki/sms-smsir @amirhossein-moloki/sms-core
```

## Usage

```typescript
import { SmsProviderRegistry, SmsService, SmsMessage } from '@amirhossein-moloki/sms-core';
import { SmsirProvider } from '@amirhossein-moloki/sms-smsir';

const registry = new SmsProviderRegistry();
const smsir = new SmsirProvider({
  apiKey: 'your_x_api_key',
  lineNumber: '300000000000',
});

registry.register(smsir);

const smsService = new SmsService(registry);
```
