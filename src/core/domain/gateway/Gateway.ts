import { GatewayCapability } from '../enums.js';

export interface GatewayProps {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly capabilities: ReadonlySet<GatewayCapability>;
}

export class Gateway {
  public readonly id: string;
  public readonly name: string;
  public readonly displayName: string;
  public readonly enabled: boolean;
  public readonly capabilities: ReadonlySet<GatewayCapability>;

  constructor(props: GatewayProps) {
    this.id = props.id;
    this.name = props.name;
    this.displayName = props.displayName;
    this.enabled = props.enabled;
    this.capabilities = new Set(props.capabilities);
    Object.freeze(this);
  }

  public supportsCapability(capability: GatewayCapability): boolean {
    return this.capabilities.has(capability);
  }
}
