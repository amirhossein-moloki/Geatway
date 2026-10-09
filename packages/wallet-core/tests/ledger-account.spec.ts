import { describe, expect, it } from 'vitest';
import {
  AccountStatus,
  AccountType,
  CurrencyMismatchError,
  LedgerAccount,
  Money,
} from '../src/index.js';

describe('LedgerAccount Domain Entity', () => {
  it('should create an active ledger account', () => {
    const account = LedgerAccount.create({
      id: 'acc-wallet-1',
      name: 'User Wallet Balance Account',
      type: AccountType.LIABILITY,
      currency: 'IRR',
      walletId: 'w-1',
    });

    expect(account.id).toBe('acc-wallet-1');
    expect(account.type).toBe(AccountType.LIABILITY);
    expect(account.currency).toBe('IRR');
    expect(account.status).toBe(AccountStatus.ACTIVE);
  });

  it('should calculate balance correctly according to account type', () => {
    const assetAccount = LedgerAccount.create({
      id: 'acc-asset-1',
      name: 'Bank Clearing Account',
      type: AccountType.ASSET,
      currency: 'USD',
    });

    const debits = Money.fromMinor(1000n, 'USD');
    const credits = Money.fromMinor(300n, 'USD');

    // ASSET normal balance: Debits - Credits = 1000 - 300 = 700
    const assetBalance = assetAccount.calculateBalance(debits, credits);
    expect(assetBalance.amount).toBe(700n);

    const liabilityAccount = LedgerAccount.create({
      id: 'acc-liab-1',
      name: 'User Wallet Account',
      type: AccountType.LIABILITY,
      currency: 'USD',
    });

    // LIABILITY normal balance: Credits - Debits = 300 - 1000 = -700
    const liabilityBalance = liabilityAccount.calculateBalance(debits, credits);
    expect(liabilityBalance.amount).toBe(-700n);
  });

  it('should reject balance calculation if money currency mismatches account currency', () => {
    const account = LedgerAccount.create({
      id: 'acc-1',
      name: 'Test Account',
      type: AccountType.ASSET,
      currency: 'IRR',
    });

    const debits = Money.fromMinor(1000n, 'USD');
    const credits = Money.fromMinor(1000n, 'IRR');

    expect(() => account.calculateBalance(debits, credits)).toThrow(CurrencyMismatchError);
  });
});
