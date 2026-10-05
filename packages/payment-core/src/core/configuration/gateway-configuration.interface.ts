export interface GatewayConfig {
  readonly gatewayId: string;
  readonly isSandbox?: boolean;
  readonly options?: Record<string, unknown>;
}

export interface GatewayConfiguration extends GatewayConfig {}

export interface GatewayConfigurationProvider {
  getConfiguration(gatewayId: string): Promise<GatewayConfig | null>;
}
