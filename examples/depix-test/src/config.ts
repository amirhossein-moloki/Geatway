export interface AppConfig {
  port: number;
  environment: 'sandbox' | 'production' | 'test';
  useMockGateways: boolean;
  mellat: {
    terminalId: number;
    userName: string;
    userPassword: string;
    callbackUrl: string;
  };
  zibal: {
    merchant: string;
    callbackUrl: string;
  };
  zarinpal: {
    accessToken: string;
    merchantId: string;
    callbackUrl: string;
  };
  saman: {
    terminalId: string;
    callbackUrl: string;
  };
}

export function loadConfig(): AppConfig {
  const env = process.env.PAYMENT_ENV || 'sandbox';
  const environment = (['sandbox', 'production', 'test'].includes(env) ? env : 'sandbox') as
    'sandbox' | 'production' | 'test';

  const port = parseInt(process.env.PORT || '3000', 10);
  const useMockGateways =
    process.env.USE_MOCK_GATEWAYS === 'true' || process.env.NODE_ENV === 'test';

  const baseUrl = `http://localhost:${port}`;

  return {
    port,
    environment,
    useMockGateways,
    mellat: {
      terminalId: Number(process.env.MELLAT_TERMINAL_ID || '1234567'),
      userName: process.env.MELLAT_USERNAME || 'test_user',
      userPassword: process.env.MELLAT_PASSWORD || 'test_pass',
      callbackUrl: process.env.MELLAT_CALLBACK_URL || `${baseUrl}/api/callbacks/mellat`,
    },
    zibal: {
      merchant: process.env.ZIBAL_MERCHANT || 'zibal',
      callbackUrl: process.env.ZIBAL_CALLBACK_URL || `${baseUrl}/api/callbacks/zibal`,
    },
    zarinpal: {
      accessToken: process.env.ZARINPAL_ACCESS_TOKEN || 'test_access_token',
      merchantId: process.env.ZARINPAL_MERCHANT_ID || '46018260-8c88-11e5-80c7-000c295eb8fc',
      callbackUrl: process.env.ZARINPAL_CALLBACK_URL || `${baseUrl}/api/callbacks/zarinpal`,
    },
    saman: {
      terminalId: process.env.SAMAN_TERMINAL_ID || '10293847',
      callbackUrl: process.env.SAMAN_CALLBACK_URL || `${baseUrl}/api/callbacks/saman`,
    },
  };
}
