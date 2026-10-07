import {
  ConfigurationError,
  GatewayConfig,
  PaymentEnvironment,
} from '@amirhossein-moloki/payment-core';

export interface ZarinpalConfig extends GatewayConfig {
  accessToken: string;
  callbackUrl: string;
  environment?: PaymentEnvironment;
  merchantId?: string;
  baseUrl?: string;
  startPayUrl?: string;
  gatewayId?: string;
}

export function validateZarinpalConfig(config: ZarinpalConfig): void {
  if (!config) {
    throw new ConfigurationError('Zarinpal config is required');
  }
  if (!config.accessToken || typeof config.accessToken !== 'string') {
    throw new ConfigurationError('Zarinpal accessToken is required and must be a string');
  }
  if (!config.callbackUrl || typeof config.callbackUrl !== 'string') {
    throw new ConfigurationError('Zarinpal callbackUrl is required and must be a string');
  }

  const isSandboxMode = config.environment === 'sandbox' || config.isSandbox === true;
  if (isSandboxMode && !config.baseUrl) {
    throw new ConfigurationError(
      'Zarinpal v4 specification does not document an official public sandbox GraphQL endpoint. A custom baseUrl must be provided in ZarinpalConfig for sandbox mode.',
    );
  }
}
