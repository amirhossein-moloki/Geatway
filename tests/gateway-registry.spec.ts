import { describe, it, expect, beforeEach } from 'vitest';
import {
  GatewayRegistry,
  MockGateway,
  GatewayCapability,
  GatewayNotFoundError,
  GatewayDisabledError,
  UnsupportedCapabilityError,
  ValidationError,
} from '../src/index.js';

describe('GatewayRegistry', () => {
  let registry: GatewayRegistry;

  beforeEach(() => {
    registry = new GatewayRegistry();
  });

  it('should register and retrieve a gateway', () => {
    const gateway = new MockGateway({ id: 'zarinpal', displayName: 'Zarinpal' });
    registry.registerGateway(gateway);

    expect(registry.hasGateway('zarinpal')).toBe(true);
    expect(registry.getGateway('zarinpal')).toBe(gateway);
  });

  it('should throw ValidationError when registering invalid gateway', () => {
    expect(() => registry.registerGateway(null as unknown as MockGateway)).toThrow(ValidationError);
  });

  it('should list all registered gateways', () => {
    registry.registerGateway(new MockGateway({ id: 'gw1', displayName: 'Gateway 1' }));
    registry.registerGateway(new MockGateway({ id: 'gw2', displayName: 'Gateway 2' }));

    const list = registry.listGateways();
    expect(list.length).toBe(2);
    expect(list.map((g) => g.id)).toEqual(['gw1', 'gw2']);
  });

  it('should throw GatewayNotFoundError for unregistered gateway', () => {
    expect(() => registry.getGateway('unknown_gw')).toThrow(GatewayNotFoundError);
  });

  it('should handle disabled gateways correctly', () => {
    const disabledGw = new MockGateway({ id: 'disabled_gw', isEnabled: false });
    registry.registerGateway(disabledGw);

    expect(registry.isEnabled('disabled_gw')).toBe(false);
    expect(() => registry.getActiveGateway('disabled_gw')).toThrow(GatewayDisabledError);
  });

  it('should validate capabilities when getting active gateway', () => {
    const gw = new MockGateway({ id: 'mock_gw' });
    registry.registerGateway(gw);

    expect(registry.supportsCapability('mock_gw', GatewayCapability.CREATE_PAYMENT)).toBe(true);
    expect(registry.getActiveGateway('mock_gw', GatewayCapability.CREATE_PAYMENT)).toBe(gw);

    expect(() => registry.getActiveGateway('mock_gw', GatewayCapability.RECURRING)).toThrow(
      UnsupportedCapabilityError,
    );
  });
});
