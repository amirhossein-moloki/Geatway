export interface AppConfig {
  port: number;
  environment: 'sandbox' | 'production' | 'test';
  useMockGateways: boolean;
  zibal: {
    merchant: string;
    callbackUrl: string;
  };
}

export function loadConfig(): AppConfig {
  const env = process.env.PAYMENT_ENV || 'sandbox';
  const environment = (['sandbox', 'production', 'test'].includes(env) ? env : 'sandbox') as
    'sandbox' | 'production' | 'test';

  const port = parseInt(process.env.PORT || '3000', 10);
  const useMockGateways = process.env.USE_MOCK_GATEWAYS === 'true';

  const baseUrl = `http://localhost:${port}`;

  return {
    port,
    environment,
    useMockGateways,
    zibal: {
      merchant: process.env.ZIBAL_MERCHANT || 'zibal',
      callbackUrl: process.env.ZIBAL_CALLBACK_URL || `${baseUrl}/api/callbacks/zibal`,
    },
  };
}
