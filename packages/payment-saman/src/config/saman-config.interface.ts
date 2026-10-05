export interface SamanConfig {
  terminalId: string;
  redirectUrl: string;
  tokenUrl?: string;
  verifyUrl?: string;
  reverseUrl?: string;
  paymentFormUrl?: string;
  gatewayId?: string;
}

export function validateSamanConfig(config: SamanConfig): void {
  if (!config) {
    throw new Error('Saman config is required');
  }
  if (!config.terminalId || typeof config.terminalId !== 'string') {
    throw new Error('Saman terminalId is required and must be a string');
  }
  if (!config.redirectUrl || typeof config.redirectUrl !== 'string') {
    throw new Error('Saman redirectUrl is required and must be a string');
  }
}
