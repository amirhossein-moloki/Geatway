import {
  ConfigurationError,
  GatewayConfig,
  PaymentEnvironment,
} from '@amirhossein-moloki/payment-core';

export interface MellatConfig extends GatewayConfig {
  readonly environment?: PaymentEnvironment;
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
    throw new ConfigurationError('Mellat configuration must be provided');
  }

  if (config.terminalId === undefined || config.terminalId === null || config.terminalId === '') {
    throw new ConfigurationError('Mellat configuration missing required field: terminalId');
  }

  if (!config.userName || typeof config.userName !== 'string' || config.userName.trim() === '') {
    throw new ConfigurationError('Mellat configuration missing required field: userName');
  }

  if (
    !config.userPassword ||
    typeof config.userPassword !== 'string' ||
    config.userPassword.trim() === ''
  ) {
    throw new ConfigurationError('Mellat configuration missing required field: userPassword');
  }

  if (
    !config.callbackUrl ||
    typeof config.callbackUrl !== 'string' ||
    config.callbackUrl.trim() === ''
  ) {
    throw new ConfigurationError('Mellat configuration missing required field: callbackUrl');
  }

  const isSandboxMode = config.environment === 'sandbox' || config.isSandbox === true;
  if (isSandboxMode && (!config.wsdlUrl || !config.portalUrl)) {
    throw new ConfigurationError(
      'Mellat v1.29 specification does not document an official public sandbox URL. A custom wsdlUrl and portalUrl must be provided in MellatConfig for sandbox mode.',
    );
  }
}
