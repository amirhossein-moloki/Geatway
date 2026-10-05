import { PaymentGateway } from '../contracts/payment-gateway.interface.js';
import { GatewayCapability } from '../domain/capabilities/gateway-capability.enum.js';
import { GatewayInfo } from '../domain/gateway/gateway.info.js';
import {
  GatewayNotFoundError,
  GatewayDisabledError,
  UnsupportedCapabilityError,
  ValidationError,
} from '../errors/index.js';

export class GatewayRegistry {
  private readonly gateways = new Map<string, PaymentGateway>();

  public register(gateway: PaymentGateway): void {
    if (!gateway || !gateway.id) {
      throw new ValidationError('Invalid gateway registration: ID is required');
    }
    this.gateways.set(gateway.id, gateway);
  }

  public registerGateway(gateway: PaymentGateway): void {
    this.register(gateway);
  }

  public remove(gatewayId: string): boolean {
    return this.gateways.delete(gatewayId);
  }

  public unregisterGateway(gatewayId: string): boolean {
    return this.remove(gatewayId);
  }

  public get(gatewayId: string): PaymentGateway {
    const gateway = this.gateways.get(gatewayId);
    if (!gateway) {
      throw new GatewayNotFoundError(gatewayId);
    }
    return gateway;
  }

  public getGateway(gatewayId: string): PaymentGateway {
    return this.get(gatewayId);
  }

  public getActiveGateway(
    gatewayId: string,
    requiredCapability?: GatewayCapability,
  ): PaymentGateway {
    const gateway = this.get(gatewayId);

    if (!gateway.isEnabled) {
      throw new GatewayDisabledError(gatewayId);
    }

    if (requiredCapability && !gateway.supportsCapability(requiredCapability)) {
      throw new UnsupportedCapabilityError(gatewayId, requiredCapability);
    }

    return gateway;
  }

  public has(gatewayId: string): boolean {
    return this.gateways.has(gatewayId);
  }

  public hasGateway(gatewayId: string): boolean {
    return this.has(gatewayId);
  }

  public isEnabled(gatewayId: string): boolean {
    const gateway = this.get(gatewayId);
    return gateway.isEnabled;
  }

  public supportsCapability(gatewayId: string, capability: GatewayCapability): boolean {
    const gateway = this.get(gatewayId);
    return gateway.supportsCapability(capability);
  }

  public list(): GatewayInfo[] {
    return Array.from(this.gateways.values()).map((gateway) => ({
      id: gateway.id,
      displayName: gateway.displayName,
      isEnabled: gateway.isEnabled,
      capabilities: gateway.capabilities,
    }));
  }

  public listGateways(): GatewayInfo[] {
    return this.list();
  }

  public clear(): void {
    this.gateways.clear();
  }
}
