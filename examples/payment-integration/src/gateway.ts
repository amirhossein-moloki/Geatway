import { GatewayRegistry } from '@amirhossein-moloki/payment-core';
import { MellatGateway } from '@company/payment-mellat';
import { ZibalGateway } from '@company/payment-zibal';
import { ZarinpalGateway } from '@company/payment-zarinpal';
import { SamanGateway } from '@company/payment-saman';
import { MockGateway } from '@company/payment-service/testing';

export function setupGatewayRegistry(): GatewayRegistry {
  const registry = new GatewayRegistry();

  if (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_GATEWAYS === 'true') {
    registry.register(new MockGateway({ id: 'mellat', scenario: 'success' }));
    registry.register(new MockGateway({ id: 'zibal', scenario: 'success' }));
    registry.register(new MockGateway({ id: 'zarinpal', scenario: 'success' }));
    registry.register(new MockGateway({ id: 'saman', scenario: 'success' }));
    return registry;
  }

  // Register Mellat Gateway
  const mellatGateway = new MellatGateway({
    gatewayId: 'mellat',
    terminalId: Number(process.env.MELLAT_TERMINAL_ID || '1234567'),
    userName: process.env.MELLAT_USERNAME || 'test_user',
    userPassword: process.env.MELLAT_PASSWORD || 'test_pass',
    callbackUrl:
      process.env.MELLAT_CALLBACK_URL || 'http://localhost:3000/api/v1/payments/callback/mellat',
    environment: (process.env.PAYMENT_ENV as 'sandbox' | 'production') || 'production',
  });
  registry.register(mellatGateway);

  // Register Zibal Gateway
  const zibalGateway = new ZibalGateway({
    gatewayId: 'zibal',
    merchant: process.env.ZIBAL_MERCHANT || 'zibal',
    callbackUrl:
      process.env.ZIBAL_CALLBACK_URL || 'http://localhost:3000/api/v1/payments/callback/zibal',
    environment: (process.env.PAYMENT_ENV as 'sandbox' | 'production') || 'sandbox',
  });
  registry.register(zibalGateway);

  // Register Zarinpal Gateway
  const zarinpalGateway = new ZarinpalGateway({
    gatewayId: 'zarinpal',
    accessToken: process.env.ZARINPAL_ACCESS_TOKEN || 'test_token',
    merchantId: process.env.ZARINPAL_MERCHANT_ID || '46018260-8c88-11e5-80c7-000c295eb8fc',
    callbackUrl:
      process.env.ZARINPAL_CALLBACK_URL ||
      'http://localhost:3000/api/v1/payments/callback/zarinpal',
    environment: (process.env.PAYMENT_ENV as 'sandbox' | 'production') || 'production',
  });
  registry.register(zarinpalGateway);

  // Register Saman Gateway
  const samanGateway = new SamanGateway({
    gatewayId: 'saman',
    terminalId: process.env.SAMAN_TERMINAL_ID || '10293847',
    redirectUrl:
      process.env.SAMAN_CALLBACK_URL || 'http://localhost:3000/api/v1/payments/callback/saman',
    environment: (process.env.PAYMENT_ENV as 'sandbox' | 'production') || 'production',
  });
  registry.register(samanGateway);

  return registry;
}
