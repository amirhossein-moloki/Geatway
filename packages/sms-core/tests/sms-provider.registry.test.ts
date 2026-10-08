import { describe, expect, it } from 'vitest';
import { SmsProvider } from '../src/core/contracts/sms-provider.interface.js';
import { SmsCapability } from '../src/core/domain/capabilities/sms-capability.enum.js';
import { SmsProviderRegistry } from '../src/core/registry/sms-provider.registry.js';
import {
  SmsProviderDisabledError,
  SmsProviderNotFoundError,
  SmsValidationError,
  UnsupportedSmsCapabilityError,
} from '../src/core/errors/index.js';

class MockSmsProvider implements SmsProvider {
  constructor(
    public readonly id: string,
    public readonly displayName: string,
    public readonly isEnabled: boolean,
    public readonly capabilities: ReadonlySet<SmsCapability>,
  ) {}

  supportsCapability(capability: SmsCapability): boolean {
    return this.capabilities.has(capability);
  }
}

describe('SmsProviderRegistry', () => {
  it('should register and retrieve a provider', () => {
    const registry = new SmsProviderRegistry();
    const provider = new MockSmsProvider(
      'sms-ir',
      'SMS.ir',
      true,
      new Set([SmsCapability.SEND_SINGLE, SmsCapability.SEND_PATTERN]),
    );

    registry.register(provider);

    expect(registry.has('sms-ir')).toBe(true);
    expect(registry.get('sms-ir')).toBe(provider);
    expect(registry.isEnabled('sms-ir')).toBe(true);
    expect(registry.supportsCapability('sms-ir', SmsCapability.SEND_SINGLE)).toBe(true);
    expect(registry.supportsCapability('sms-ir', SmsCapability.WEBHOOK)).toBe(false);
  });

  it('should throw SmsValidationError when registering invalid provider', () => {
    const registry = new SmsProviderRegistry();
    expect(() => registry.register(null as unknown as SmsProvider)).toThrow(SmsValidationError);
  });

  it('should throw SmsProviderNotFoundError for unregistered provider', () => {
    const registry = new SmsProviderRegistry();
    expect(() => registry.get('non-existent')).toThrow(SmsProviderNotFoundError);
  });

  it('should throw SmsProviderDisabledError when getting disabled provider as active', () => {
    const registry = new SmsProviderRegistry();
    const disabledProvider = new MockSmsProvider(
      'disabled-p',
      'Disabled Provider',
      false,
      new Set(),
    );
    registry.register(disabledProvider);

    expect(() => registry.getActiveProvider('disabled-p')).toThrow(SmsProviderDisabledError);
  });

  it('should throw UnsupportedSmsCapabilityError when required capability is missing', () => {
    const registry = new SmsProviderRegistry();
    const provider = new MockSmsProvider(
      'sms-ir',
      'SMS.ir',
      true,
      new Set([SmsCapability.SEND_SINGLE]),
    );
    registry.register(provider);

    expect(() => registry.getActiveProvider('sms-ir', SmsCapability.WEBHOOK)).toThrow(
      UnsupportedSmsCapabilityError,
    );
  });

  it('should list registered providers info', () => {
    const registry = new SmsProviderRegistry();
    const p1 = new MockSmsProvider('p1', 'Provider 1', true, new Set([SmsCapability.SEND_SINGLE]));
    const p2 = new MockSmsProvider('p2', 'Provider 2', false, new Set([SmsCapability.GET_BALANCE]));

    registry.register(p1);
    registry.register(p2);

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe('p1');
    expect(list[1]?.id).toBe('p2');
  });

  it('should unregister and clear providers', () => {
    const registry = new SmsProviderRegistry();
    const provider = new MockSmsProvider('sms-ir', 'SMS.ir', true, new Set());
    registry.register(provider);

    expect(registry.remove('sms-ir')).toBe(true);
    expect(registry.has('sms-ir')).toBe(false);

    registry.register(provider);
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});
