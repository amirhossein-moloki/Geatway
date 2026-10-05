import { GatewayCapability } from '../capabilities/gateway-capability.enum.js';

export interface GatewayInfo {
  readonly id: string;
  readonly displayName: string;
  readonly isEnabled: boolean;
  readonly capabilities: ReadonlySet<GatewayCapability>;
}
