import { SmsCapability } from '../capabilities/sms-capability.enum.js';

export interface ProviderInfo {
  readonly id: string;
  readonly displayName: string;
  readonly isEnabled: boolean;
  readonly capabilities: ReadonlySet<SmsCapability>;
}
