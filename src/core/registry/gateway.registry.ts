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

  public registerGateway(gateway: PaymentGateway): void {
    if (!gateway || !gateway.id) {
      throw new ValidationError('Invalid gateway registration: ID is required');
    }
    this.gateways.set(gateway.id, gateway);
  }

  public unregisterGateway(gatewayId: string): boolean {
    return this.gateways.delete(gatewayId);
  }

  public getGateway(gatewayId: string): PaymentGateway {
    const gateway = this.gateways.get(gatewayId);
    if (!gateway) {
      throw new GatewayNotFoundError(gatewayId);
    }
    return gateway;
  }

  public getActiveGateway(
    gatewayId: string,
    requiredCapability?: GatewayCapability,
  ): PaymentGateway {
    const gateway = this.getGateway(gatewayId);

    if (!gateway.isEnabled) {
      throw new GatewayDisabledError(gatewayId);
    }

    if (requiredCapability && !gateway.supportsCapability(requiredCapability)) {
      throw new UnsupportedCapabilityError(gatewayId, requiredCapability);
    }

    return gateway;
  }

  public hasGateway(gatewayId: string): boolean {
    return this.gateways.has(gatewayId);
  }

  public isEnabled(gatewayId: string): boolean {
    const gateway = this.getGateway(gatewayId);
    return gateway.isEnabled;
  }

  public supportsCapability(gatewayId: string, capability: GatewayCapability): boolean {
    const gateway = this.getGateway(gatewayId);
    return gateway.supportsCapability(capability);
  }

  public listGateways(): GatewayInfo[] {
    return Array.from(this.gateways.values()).map((gateway) => ({
      id: gateway.id,
      displayName: gateway.displayName,
      isEnabled: gateway.isEnabled,
      capabilities: gateway.capabilities,
    }));
  }

  public clear(): void {
    this.gateways.clear();
  }
}
