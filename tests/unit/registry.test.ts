import { describe, it, expect, beforeEach } from 'vitest';
import {
  GatewayRegistry,
  MockGateway,
  GatewayCapability,
  GatewayNotFoundError,
  GatewayDisabledError,
  UnsupportedCapabilityError,
} from '../../src';

describe('GatewayRegistry', () => {
  let registry: GatewayRegistry;
  let mockGw: MockGateway;

  beforeEach(() => {
    registry = new GatewayRegistry();
    mockGw = new MockGateway({ id: 'mock', enabled: true });
  });

  it('registers and retrieves a gateway', () => {
    registry.registerGateway(mockGw);
    expect(registry.hasGateway('mock')).toBe(true);
    expect(registry.getGateway('mock')).toBe(mockGw);
  });

  it('lists all registered gateways', () => {
    registry.registerGateway(mockGw);
    const list = registry.listGateways();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe('mock');
  });

  it('throws GatewayNotFoundError when gateway does not exist', () => {
    expect(() => registry.getGateway('non_existent')).toThrow(GatewayNotFoundError);
  });

  it('checks enabled status and capability support', () => {
    registry.registerGateway(mockGw);
    expect(registry.isEnabled('mock')).toBe(true);
    expect(registry.supportsCapability('mock', GatewayCapability.CREATE_PAYMENT)).toBe(true);
    expect(registry.supportsCapability('mock', GatewayCapability.TOKENIZATION)).toBe(false);
  });

  it('throws GatewayDisabledError when resolving disabled gateway', () => {
    const disabledGw = new MockGateway({ id: 'disabled_gw', enabled: false });
    registry.registerGateway(disabledGw);

    expect(() =>
      registry.resolveGatewayForOperation('disabled_gw', GatewayCapability.CREATE_PAYMENT),
    ).toThrow(GatewayDisabledError);
  });

  it('throws UnsupportedCapabilityError when gateway lacks capability', () => {
    const limitedGw = new MockGateway({
      id: 'limited_gw',
      capabilities: new Set([GatewayCapability.CREATE_PAYMENT]),
    });
    registry.registerGateway(limitedGw);

    expect(() =>
      registry.resolveGatewayForOperation('limited_gw', GatewayCapability.REFUND),
    ).toThrow(UnsupportedCapabilityError);
  });
});
