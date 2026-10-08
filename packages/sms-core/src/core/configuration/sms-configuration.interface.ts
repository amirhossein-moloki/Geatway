export type SmsEnvironment = 'production' | 'sandbox' | 'test';

export interface SmsProviderConfig {
  readonly providerId?: string;
  readonly environment?: SmsEnvironment;
  readonly isSandbox?: boolean;
  readonly apiKey?: string;
  readonly lineNumber?: string | number;
  readonly options?: Record<string, unknown>;
}

export interface SmsProviderConfiguration extends SmsProviderConfig {}

export interface SmsProviderConfigurationProvider {
  getConfiguration(providerId: string): Promise<SmsProviderConfig | null>;
}
