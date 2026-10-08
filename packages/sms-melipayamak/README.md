# @amirhossein-moloki/sms-melipayamak

Melipayamak SMS provider integration for `@amirhossein-moloki/sms-core`.

## Installation

```bash
pnpm add @amirhossein-moloki/sms-melipayamak @amirhossein-moloki/sms-core
```

## Usage

```typescript
import { SmsProviderRegistry, SmsService, SmsMessage } from '@amirhossein-moloki/sms-core';
import { MelipayamakProvider } from '@amirhossein-moloki/sms-melipayamak';

const registry = new SmsProviderRegistry();
const melipayamak = new MelipayamakProvider({
  username: 'your_username',
  password: 'your_password',
  from: '5000...',
});

registry.register(melipayamak);

const smsService = new SmsService(registry);
```
