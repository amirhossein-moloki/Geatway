import { GatewayConfig } from '@company/payment-core';

export interface MellatConfig extends GatewayConfig {
  readonly terminalId: string | number;
  readonly userName: string;
  readonly userPassword: string;
  readonly callbackUrl: string;
  readonly requestTimeoutMs?: number;
  readonly portalUrl?: string;
  readonly wsdlUrl?: string;
  readonly subServiceId?: string | number;
}

export function validateMellatConfig(config: MellatConfig): void {
  if (!config) {
    throw new Error('Mellat configuration must be provided');
  }

  if (config.terminalId === undefined || config.terminalId === null || config.terminalId === '') {
    throw new Error('Mellat configuration missing required field: terminalId');
  }

  if (!config.userName || typeof config.userName !== 'string' || config.userName.trim() === '') {
    throw new Error('Mellat configuration missing required field: userName');
  }

  if (
    !config.userPassword ||
    typeof config.userPassword !== 'string' ||
    config.userPassword.trim() === ''
  ) {
    throw new Error('Mellat configuration missing required field: userPassword');
  }

  if (
    !config.callbackUrl ||
    typeof config.callbackUrl !== 'string' ||
    config.callbackUrl.trim() === ''
  ) {
    throw new Error('Mellat configuration missing required field: callbackUrl');
  }
}
