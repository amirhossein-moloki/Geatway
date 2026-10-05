import { describe, it, expect, beforeEach } from 'vitest';
import { GatewayRegistry } from '../src/core/registry/gateway.registry.js';
import { MockGateway } from './mocks/mock-gateway.js';
import { GatewayCapability } from '../src/core/domain/capabilities/gateway-capability.enum.js';
import { PaymentGateway } from '../src/core/contracts/payment-gateway.interface.js';
import {
  GatewayNotFoundError,
  GatewayDisabledError,
  UnsupportedCapabilityError,
  ValidationError,
} from '../src/core/errors/index.js';

describe('GatewayRegistry', () => {
  let registry: GatewayRegistry;

  beforeEach(() => {
    registry = new GatewayRegistry();
  });

  it('should register and retrieve a gateway', () => {
    const gateway = new MockGateway({ id: 'mellat' });
    registry.register(gateway);

    expect(registry.has('mellat')).toBe(true);
    expect(registry.get('mellat')).toBe(gateway);
  });

  it('should throw ValidationError if gateway ID is missing', () => {
    expect(() => registry.register({} as PaymentGateway)).toThrow(ValidationError);
  });

  it('should list all registered gateways', () => {
    registry.register(new MockGateway({ id: 'g1' }));
    registry.register(new MockGateway({ id: 'g2' }));

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((g) => g.id)).toEqual(['g1', 'g2']);
  });

  it('should remove a gateway', () => {
    const gateway = new MockGateway({ id: 'g1' });
    registry.register(gateway);
    expect(registry.remove('g1')).toBe(true);
    expect(registry.has('g1')).toBe(false);
  });

  it('should throw GatewayNotFoundError if gateway is not found', () => {
    expect(() => registry.get('non_existent')).toThrow(GatewayNotFoundError);
  });

  it('should throw GatewayDisabledError if active gateway is disabled', () => {
    const gateway = new MockGateway({ id: 'disabled_gateway', isEnabled: false });
    registry.register(gateway);

    expect(() => registry.getActiveGateway('disabled_gateway')).toThrow(GatewayDisabledError);
  });

  it('should throw UnsupportedCapabilityError if required capability is unsupported', () => {
    const gateway = new MockGateway({ id: 'limited_gateway' });
    registry.register(gateway);

    expect(() =>
      registry.getActiveGateway('limited_gateway', GatewayCapability.TOKENIZATION),
    ).toThrow(UnsupportedCapabilityError);
  });
});
