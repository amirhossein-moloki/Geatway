import { GatewayRegistry } from '@amirhossein-moloki/payment-core';
import { MellatGateway } from '@amirhossein-moloki/payment-mellat';
import { ZibalGateway } from '@amirhossein-moloki/payment-zibal';
import { ZarinpalGateway } from '@amirhossein-moloki/payment-zarinpal';
import { SamanGateway } from '@amirhossein-moloki/payment-saman';
import { MockGateway } from '@amirhossein-moloki/payment-service/testing';
import { AppConfig } from './config.js';

export function createGatewayRegistry(config: AppConfig): GatewayRegistry {
  const registry = new GatewayRegistry();

  if (config.useMockGateways) {
    registry.register(new MockGateway({ id: 'mellat', scenario: 'success' }));
    registry.register(new MockGateway({ id: 'zibal', scenario: 'success' }));
    registry.register(new MockGateway({ id: 'zarinpal', scenario: 'success' }));
    registry.register(new MockGateway({ id: 'saman', scenario: 'success' }));
    registry.register(new MockGateway({ id: 'mock', scenario: 'success' }));
    return registry;
  }

  // Register Mellat Gateway
  const mellatGateway = new MellatGateway({
    gatewayId: 'mellat',
    terminalId: config.mellat.terminalId,
    userName: config.mellat.userName,
    userPassword: config.mellat.userPassword,
    callbackUrl: config.mellat.callbackUrl,
    environment: config.environment === 'production' ? 'production' : 'sandbox',
  });
  registry.register(mellatGateway);

  // Register Zibal Gateway
  const zibalGateway = new ZibalGateway({
    gatewayId: 'zibal',
    merchant: config.zibal.merchant,
    callbackUrl: config.zibal.callbackUrl,
    environment: config.environment === 'production' ? 'production' : 'sandbox',
  });
  registry.register(zibalGateway);

  // Register Zarinpal Gateway
  const zarinpalGateway = new ZarinpalGateway({
    gatewayId: 'zarinpal',
    accessToken: config.zarinpal.accessToken,
    merchantId: config.zarinpal.merchantId,
    callbackUrl: config.zarinpal.callbackUrl,
    environment: config.environment === 'production' ? 'production' : 'sandbox',
  });
  registry.register(zarinpalGateway);

  // Register Saman Gateway
  const samanGateway = new SamanGateway({
    gatewayId: 'saman',
    terminalId: config.saman.terminalId,
    redirectUrl: config.saman.callbackUrl,
    environment: config.environment === 'production' ? 'production' : 'sandbox',
  });
  registry.register(samanGateway);

  // Register Mock Gateway as backup or testing option
  registry.register(new MockGateway({ id: 'mock', scenario: 'success' }));

  return registry;
}
