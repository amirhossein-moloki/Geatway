export interface GatewayConfiguration {
  readonly gatewayId: string;
  readonly isSandbox: boolean;
  readonly options?: Record<string, unknown>;
}

export interface GatewayConfigurationProvider {
  getConfiguration(gatewayId: string): Promise<GatewayConfiguration | null>;
}
