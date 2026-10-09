import { AccountStatus } from './account-status.enum.js';
import { AccountType } from './account-type.enum.js';
import { Money } from '../money/money.value-object.js';
import { CurrencyMismatchError } from '../../errors/wallet.errors.js';

export interface CreateLedgerAccountProps {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  walletId?: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerAccountProps extends CreateLedgerAccountProps {
  status: AccountStatus;
  createdAt: Date;
}

export class LedgerAccount {
  public readonly id: string;
  public readonly name: string;
  public readonly type: AccountType;
  public readonly currency: string;
  public readonly walletId?: string;
  public readonly status: AccountStatus;
  public readonly createdAt: Date;
  public readonly metadata?: Record<string, unknown>;

  constructor(props: LedgerAccountProps) {
    if (!props.id || typeof props.id !== 'string' || props.id.trim() === '') {
      throw new Error('LedgerAccount id must be a non-empty string');
    }
    if (!props.name || typeof props.name !== 'string' || props.name.trim() === '') {
      throw new Error('LedgerAccount name must be a non-empty string');
    }
    if (!props.currency || typeof props.currency !== 'string' || props.currency.trim() === '') {
      throw new Error('LedgerAccount currency must be a non-empty string');
    }

    this.id = props.id.trim();
    this.name = props.name.trim();
    this.type = props.type;
    this.currency = props.currency.trim().toUpperCase();
    this.walletId = props.walletId?.trim();
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.metadata = props.metadata ? { ...props.metadata } : undefined;
  }

  public static create(props: CreateLedgerAccountProps): LedgerAccount {
    return new LedgerAccount({
      ...props,
      status: AccountStatus.ACTIVE,
      createdAt: new Date(),
    });
  }

  public calculateBalance(totalDebits: Money, totalCredits: Money): Money {
    if (totalDebits.currency !== this.currency) {
      throw new CurrencyMismatchError(this.currency, totalDebits.currency, 'Total debits currency does not match account currency');
    }
    if (totalCredits.currency !== this.currency) {
      throw new CurrencyMismatchError(this.currency, totalCredits.currency, 'Total credits currency does not match account currency');
    }

    switch (this.type) {
      case AccountType.ASSET:
      case AccountType.EXPENSE:
        return totalDebits.subtract(totalCredits);

      case AccountType.LIABILITY:
      case AccountType.EQUITY:
      case AccountType.REVENUE:
        return totalCredits.subtract(totalDebits);

      default:
        throw new Error(`Unsupported account type: ${this.type}`);
    }
  }
}
