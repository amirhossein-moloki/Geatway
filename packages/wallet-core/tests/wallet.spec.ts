import { describe, expect, it } from 'vitest';
import {
  InvalidWalletStateError,
  Wallet,
  WalletClosedError,
  WalletFrozenError,
  WalletStatus,
} from '../src/index.js';

describe('Wallet Aggregate', () => {
  it('should create a new wallet in ACTIVE status', () => {
    const wallet = Wallet.create({
      id: 'w-1',
      ownerId: 'usr-100',
      currency: 'IRR',
      metadata: { tier: 'gold' },
    });

    expect(wallet.id).toBe('w-1');
    expect(wallet.ownerId).toBe('usr-100');
    expect(wallet.currency).toBe('IRR');
    expect(wallet.status).toBe(WalletStatus.ACTIVE);
    expect(wallet.canTransact()).toBe(true);
    expect(wallet.metadata.tier).toBe('gold');
  });

  it('should handle freeze and unfreeze transitions', () => {
    const wallet = Wallet.create({
      id: 'w-2',
      ownerId: 'usr-101',
      currency: 'USD',
    });

    wallet.freeze('Suspicious activity');
    expect(wallet.status).toBe(WalletStatus.FROZEN);
    expect(wallet.canTransact()).toBe(false);
    expect(wallet.metadata.freezeReason).toBe('Suspicious activity');
    expect(() => wallet.assertCanTransact()).toThrow(WalletFrozenError);

    wallet.unfreeze();
    expect(wallet.status).toBe(WalletStatus.ACTIVE);
    expect(wallet.canTransact()).toBe(true);
    expect(() => wallet.assertCanTransact()).not.toThrow();
  });

  it('should handle close transition and reject ops on closed wallet', () => {
    const wallet = Wallet.create({
      id: 'w-3',
      ownerId: 'usr-102',
      currency: 'IRT',
    });

    wallet.close();
    expect(wallet.status).toBe(WalletStatus.CLOSED);
    expect(wallet.canTransact()).toBe(false);
    expect(() => wallet.assertCanTransact()).toThrow(WalletClosedError);

    expect(() => wallet.freeze('test')).toThrow(InvalidWalletStateError);
    expect(() => wallet.unfreeze()).toThrow(InvalidWalletStateError);
  });
});
