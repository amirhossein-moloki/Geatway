import { Wallet, WalletStatus } from '../domain/wallet/index.js';

export interface IWalletRepository {
  findById(id: string): Promise<Wallet | null>;
  findByOwnerId(ownerId: string): Promise<Wallet[]>;
  save(wallet: Wallet): Promise<Wallet>;
  updateStatus(id: string, status: WalletStatus): Promise<void>;
}
