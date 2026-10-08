import { SmsValidationError } from '@amirhossein-moloki/sms-core';

export interface SmsirConfig {
  readonly apiKey: string;
  readonly lineNumber?: string | number;
  readonly providerId?: string;
  readonly baseUrl?: string;
  readonly isEnabled?: boolean;
}

export function validateSmsirConfig(config: SmsirConfig): void {
  if (!config) {
    throw new SmsValidationError('SMS.ir configuration object is required');
  }
  if (!config.apiKey || config.apiKey.trim() === '') {
    throw new SmsValidationError('SMS.ir apiKey (X-API-KEY) is required');
  }
}
