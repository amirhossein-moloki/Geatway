export type PaymentEnvironment = 'production' | 'sandbox' | 'test';

export interface GatewayConfig {
  readonly gatewayId?: string;
  readonly environment?: PaymentEnvironment;
  readonly isSandbox?: boolean;
  readonly options?: Record<string, unknown>;
}

export interface GatewayConfiguration extends GatewayConfig {}

export interface GatewayConfigurationProvider {
  getConfiguration(gatewayId: string): Promise<GatewayConfig | null>;
}
