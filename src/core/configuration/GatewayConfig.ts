export interface GatewayConfigSpec {
  readonly gatewayId: string;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface GatewayConfigProvider {
  getConfig(gatewayId: string): Promise<GatewayConfigSpec | null>;
}

export class InMemoryGatewayConfigProvider implements GatewayConfigProvider {
  private configs = new Map<string, GatewayConfigSpec>();

  public setConfig(spec: GatewayConfigSpec): void {
    this.configs.set(spec.gatewayId, spec);
  }

  public async getConfig(gatewayId: string): Promise<GatewayConfigSpec | null> {
    return this.configs.get(gatewayId) ?? null;
  }
}
