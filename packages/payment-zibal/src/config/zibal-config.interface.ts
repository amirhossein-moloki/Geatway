import { ConfigurationError, GatewayConfig, PaymentEnvironment } from '@company/payment-core';

export interface ZibalConfig extends GatewayConfig {
  merchant: string;
  callbackUrl: string;
  environment?: PaymentEnvironment;
  baseUrl?: string;
  gatewayId?: string;
}

export function validateZibalConfig(config: ZibalConfig): void {
  if (!config) {
    throw new ConfigurationError('Zibal config is required');
  }
  if (!config.merchant || typeof config.merchant !== 'string') {
    throw new ConfigurationError('Zibal merchant is required and must be a string');
  }
  if (!config.callbackUrl || typeof config.callbackUrl !== 'string') {
    throw new ConfigurationError('Zibal callbackUrl is required and must be a string');
  }

  const env = config.environment;
  if (env === 'production' && config.merchant === 'zibal') {
    throw new ConfigurationError(
      "Safety Error: Production environment cannot use Zibal test merchant 'zibal'",
    );
  }
}
