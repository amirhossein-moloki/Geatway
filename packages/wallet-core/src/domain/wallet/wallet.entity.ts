import { WalletStatus } from './wallet-status.enum.js';
import {
  InvalidWalletStateError,
  WalletClosedError,
  WalletFrozenError,
} from '../../errors/wallet.errors.js';

export interface CreateWalletProps {
  id: string;
  ownerId: string;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface WalletProps extends CreateWalletProps {
  status: WalletStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Wallet {
  public readonly id: string;
  public readonly ownerId: string;
  public readonly currency: string;
  private _status: WalletStatus;
  public readonly createdAt: Date;
  private _updatedAt: Date;
  private _metadata: Record<string, unknown>;

  constructor(props: WalletProps) {
    if (!props.id || typeof props.id !== 'string' || props.id.trim() === '') {
      throw new Error('Wallet id must be a non-empty string');
    }
    if (!props.ownerId || typeof props.ownerId !== 'string' || props.ownerId.trim() === '') {
      throw new Error('Wallet ownerId must be a non-empty string');
    }
    if (!props.currency || typeof props.currency !== 'string' || props.currency.trim() === '') {
      throw new Error('Wallet currency must be a non-empty string');
    }

    this.id = props.id.trim();
    this.ownerId = props.ownerId.trim();
    this.currency = props.currency.trim().toUpperCase();
    this._status = props.status;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._metadata = props.metadata ? { ...props.metadata } : {};
  }

  public static create(props: CreateWalletProps): Wallet {
    const now = new Date();
    return new Wallet({
      ...props,
      status: WalletStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  public get status(): WalletStatus {
    return this._status;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }

  public canTransact(): boolean {
    return this._status === WalletStatus.ACTIVE;
  }

  public assertCanTransact(): void {
    if (this._status === WalletStatus.FROZEN) {
      throw new WalletFrozenError(this.id);
    }
    if (this._status === WalletStatus.CLOSED) {
      throw new WalletClosedError(this.id);
    }
  }

  public freeze(reason?: string): void {
    if (this._status === WalletStatus.CLOSED) {
      throw new InvalidWalletStateError(this._status, WalletStatus.FROZEN, {
        walletId: this.id,
        reason: 'Cannot freeze a closed wallet',
      });
    }
    if (this._status === WalletStatus.FROZEN) {
      return;
    }
    this._status = WalletStatus.FROZEN;
    this._updatedAt = new Date();
    if (reason) {
      this._metadata = { ...this._metadata, freezeReason: reason };
    }
  }

  public unfreeze(): void {
    if (this._status === WalletStatus.CLOSED) {
      throw new InvalidWalletStateError(this._status, WalletStatus.ACTIVE, {
        walletId: this.id,
        reason: 'Cannot unfreeze a closed wallet',
      });
    }
    if (this._status === WalletStatus.ACTIVE) {
      return;
    }
    this._status = WalletStatus.ACTIVE;
    this._updatedAt = new Date();
  }

  public close(): void {
    if (this._status === WalletStatus.CLOSED) {
      return;
    }
    this._status = WalletStatus.CLOSED;
    this._updatedAt = new Date();
  }
}
