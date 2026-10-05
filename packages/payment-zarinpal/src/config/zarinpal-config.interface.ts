export interface ZarinpalConfig {
  accessToken: string;
  merchantId?: string;
  callbackUrl: string;
  baseUrl?: string;
  startPayUrl?: string;
  gatewayId?: string;
}

export function validateZarinpalConfig(config: ZarinpalConfig): void {
  if (!config) {
    throw new Error('Zarinpal config is required');
  }
  if (!config.accessToken || typeof config.accessToken !== 'string') {
    throw new Error('Zarinpal accessToken is required and must be a string');
  }
  if (!config.callbackUrl || typeof config.callbackUrl !== 'string') {
    throw new Error('Zarinpal callbackUrl is required and must be a string');
  }
}
