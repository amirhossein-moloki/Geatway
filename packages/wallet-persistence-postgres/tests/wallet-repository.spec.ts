import { describe, it, expect, beforeEach } from 'vitest';
import { Wallet, WalletStatus } from '@amirhossein-moloki/wallet-core';
import { RepositoryNotFoundError } from '@amirhossein-moloki/payment-core';
import { PostgresWalletRepository } from '../src/repositories/postgres-wallet-repository.js';
import { createTestDatabase } from './test-utils.js';
import { PgExecutor } from '../src/migrator.js';

describe('PostgresWalletRepository', () => {
  let db: PgExecutor;
  let walletRepo: PostgresWalletRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    walletRepo = new PostgresWalletRepository(db);
  });

  it('should create and retrieve a wallet by ID', async () => {
    const wallet = Wallet.create({
      id: 'wallet_1001',
      ownerId: 'user_5001',
      currency: 'IRR',
      metadata: { tier: 'gold' },
    });

    const saved = await walletRepo.save(wallet);
    expect(saved.id).toBe('wallet_1001');
    expect(saved.ownerId).toBe('user_5001');
    expect(saved.currency).toBe('IRR');
    expect(saved.status).toBe(WalletStatus.ACTIVE);
    expect(saved.metadata).toEqual({ tier: 'gold' });

    const found = await walletRepo.findById('wallet_1001');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('wallet_1001');
    expect(found?.ownerId).toBe('user_5001');
    expect(found?.currency).toBe('IRR');
  });

  it('should return null when finding non-existent wallet by ID', async () => {
    const found = await walletRepo.findById('wallet_non_existent');
    expect(found).toBeNull();
  });

  it('should find wallets by owner ID', async () => {
    const w1 = Wallet.create({
      id: 'wallet_owner1_1',
      ownerId: 'owner_99',
      currency: 'IRR',
    });
    const w2 = Wallet.create({
      id: 'wallet_owner1_2',
      ownerId: 'owner_99',
      currency: 'USD',
    });

    await walletRepo.save(w1);
    await walletRepo.save(w2);

    const ownerWallets = await walletRepo.findByOwnerId('owner_99');
    expect(ownerWallets.length).toBe(2);
    const ids = ownerWallets.map((w) => w.id);
    expect(ids).toContain('wallet_owner1_1');
    expect(ids).toContain('wallet_owner1_2');
  });

  it('should update wallet status', async () => {
    const wallet = Wallet.create({
      id: 'wallet_freeze_me',
      ownerId: 'user_123',
      currency: 'IRR',
    });
    await walletRepo.save(wallet);

    await walletRepo.updateStatus('wallet_freeze_me', WalletStatus.FROZEN);

    const updated = await walletRepo.findById('wallet_freeze_me');
    expect(updated?.status).toBe(WalletStatus.FROZEN);
  });

  it('should throw RepositoryNotFoundError when updating status of non-existent wallet', async () => {
    await expect(
      walletRepo.updateStatus('wallet_does_not_exist', WalletStatus.CLOSED),
    ).rejects.toThrow(RepositoryNotFoundError);
  });
});
