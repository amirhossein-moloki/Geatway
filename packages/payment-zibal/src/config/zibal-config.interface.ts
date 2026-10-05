export interface ZibalConfig {
  merchant: string;
  callbackUrl: string;
  baseUrl?: string;
  gatewayId?: string;
}

export function validateZibalConfig(config: ZibalConfig): void {
  if (!config) {
    throw new Error('Zibal config is required');
  }
  if (!config.merchant || typeof config.merchant !== 'string') {
    throw new Error('Zibal merchant is required and must be a string');
  }
  if (!config.callbackUrl || typeof config.callbackUrl !== 'string') {
    throw new Error('Zibal callbackUrl is required and must be a string');
  }
}
