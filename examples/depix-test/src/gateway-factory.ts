import { GatewayRegistry } from '@amirhossein-moloki/payment-core';
import { ZibalGateway } from '@amirhossein-moloki/payment-zibal';
import { MockGateway } from '@amirhossein-moloki/payment-service/testing';
import { AppConfig } from './config.js';

export function createGatewayRegistry(config: AppConfig): GatewayRegistry {
  const registry = new GatewayRegistry();

  if (config.useMockGateways) {
    // Register MockGateway for zibal testing when mock mode is explicitly requested
    registry.register(new MockGateway({ id: 'zibal', scenario: 'success' }));
    return registry;
  }

  // Register real Zibal Gateway for Sandbox/Production
  const zibalGateway = new ZibalGateway({
    gatewayId: 'zibal',
    merchant: config.zibal.merchant,
    callbackUrl: config.zibal.callbackUrl,
    environment: config.environment === 'production' ? 'production' : 'sandbox',
  });
  registry.register(zibalGateway);

  return registry;
}
