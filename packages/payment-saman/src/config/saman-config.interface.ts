import { ConfigurationError, GatewayConfig, PaymentEnvironment } from '@company/payment-core';

export interface SamanConfig extends GatewayConfig {
  terminalId: string;
  redirectUrl: string;
  environment?: PaymentEnvironment;
  tokenUrl?: string;
  verifyUrl?: string;
  reverseUrl?: string;
  paymentFormUrl?: string;
  gatewayId?: string;
}

export function validateSamanConfig(config: SamanConfig): void {
  if (!config) {
    throw new ConfigurationError('Saman config is required');
  }
  if (!config.terminalId || typeof config.terminalId !== 'string') {
    throw new ConfigurationError('Saman terminalId is required and must be a string');
  }
  if (!config.redirectUrl || typeof config.redirectUrl !== 'string') {
    throw new ConfigurationError('Saman redirectUrl is required and must be a string');
  }

  const isSandboxMode = config.environment === 'sandbox' || config.isSandbox === true;
  if (isSandboxMode && (!config.tokenUrl || !config.verifyUrl)) {
    throw new ConfigurationError(
      'Saman Postman specification does not document an official public sandbox URL. Custom tokenUrl and verifyUrl must be provided in SamanConfig for sandbox mode.',
    );
  }
}
