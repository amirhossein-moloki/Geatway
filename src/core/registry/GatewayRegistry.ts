import { GatewayCapability } from '../domain/enums';
import { PaymentGateway } from '../contracts/PaymentGateway';
import { GatewayNotFoundError, GatewayDisabledError, UnsupportedCapabilityError } from '../errors';

export class GatewayRegistry {
  private readonly gateways = new Map<string, PaymentGateway>();

  public registerGateway(gateway: PaymentGateway): void {
    this.gateways.set(gateway.id, gateway);
  }

  public getGateway(id: string): PaymentGateway {
    const gateway = this.gateways.get(id);
    if (!gateway) {
      throw new GatewayNotFoundError(id);
    }
    return gateway;
  }

  public hasGateway(id: string): boolean {
    return this.gateways.has(id);
  }

  public listGateways(): readonly PaymentGateway[] {
    return Array.from(this.gateways.values());
  }

  public isEnabled(id: string): boolean {
    const gateway = this.getGateway(id);
    return gateway.enabled;
  }

  public supportsCapability(id: string, capability: GatewayCapability): boolean {
    const gateway = this.getGateway(id);
    return gateway.capabilities.has(capability);
  }

  public resolveGatewayForOperation(
    id: string,
    requiredCapability?: GatewayCapability,
  ): PaymentGateway {
    const gateway = this.getGateway(id);

    if (!gateway.enabled) {
      throw new GatewayDisabledError(id);
    }

    if (requiredCapability && !gateway.capabilities.has(requiredCapability)) {
      throw new UnsupportedCapabilityError(id, requiredCapability);
    }

    return gateway;
  }
}
