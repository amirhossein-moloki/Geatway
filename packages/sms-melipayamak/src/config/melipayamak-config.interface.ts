import { SmsValidationError } from '@amirhossein-moloki/sms-core';

export interface MelipayamakConfig {
  readonly username: string;
  readonly password: string;
  readonly from?: string;
  readonly providerId?: string;
  readonly baseUrl?: string;
  readonly isEnabled?: boolean;
}

export function validateMelipayamakConfig(config: MelipayamakConfig): void {
  if (!config) {
    throw new SmsValidationError('Melipayamak configuration object is required');
  }
  if (!config.username || config.username.trim() === '') {
    throw new SmsValidationError('Melipayamak username is required');
  }
  if (!config.password || config.password.trim() === '') {
    throw new SmsValidationError('Melipayamak password is required');
  }
}
