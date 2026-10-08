import { SmsProvider } from '../contracts/sms-provider.interface.js';
import { SmsCapability } from '../domain/capabilities/sms-capability.enum.js';
import { ProviderInfo } from '../domain/provider/provider-info.interface.js';
import {
  SmsProviderDisabledError,
  SmsProviderNotFoundError,
  SmsValidationError,
  UnsupportedSmsCapabilityError,
} from '../errors/index.js';

export class SmsProviderRegistry {
  private readonly providers = new Map<string, SmsProvider>();

  public register(provider: SmsProvider): void {
    if (!provider || !provider.id) {
      throw new SmsValidationError('Invalid provider registration: ID is required');
    }
    this.providers.set(provider.id, provider);
  }

  public registerProvider(provider: SmsProvider): void {
    this.register(provider);
  }

  public remove(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  public unregisterProvider(providerId: string): boolean {
    return this.remove(providerId);
  }

  public get(providerId: string): SmsProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new SmsProviderNotFoundError(providerId);
    }
    return provider;
  }

  public getProvider(providerId: string): SmsProvider {
    return this.get(providerId);
  }

  public getActiveProvider(providerId: string, requiredCapability?: SmsCapability): SmsProvider {
    const provider = this.get(providerId);

    if (!provider.isEnabled) {
      throw new SmsProviderDisabledError(providerId);
    }

    if (requiredCapability && !provider.supportsCapability(requiredCapability)) {
      throw new UnsupportedSmsCapabilityError(providerId, requiredCapability);
    }

    return provider;
  }

  public has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  public hasProvider(providerId: string): boolean {
    return this.has(providerId);
  }

  public isEnabled(providerId: string): boolean {
    const provider = this.get(providerId);
    return provider.isEnabled;
  }

  public supportsCapability(providerId: string, capability: SmsCapability): boolean {
    const provider = this.get(providerId);
    return provider.supportsCapability(capability);
  }

  public list(): ProviderInfo[] {
    return Array.from(this.providers.values()).map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      isEnabled: provider.isEnabled,
      capabilities: provider.capabilities,
    }));
  }

  public listProviders(): ProviderInfo[] {
    return this.list();
  }

  public clear(): void {
    this.providers.clear();
  }
}
