import { EntryDirection } from './entry-direction.enum.js';
import { Money } from '../money/money.value-object.js';
import { InvalidLedgerEntryError } from '../../errors/wallet.errors.js';

export interface CreateLedgerEntryProps {
  id: string;
  transactionId?: string;
  accountId: string;
  direction: EntryDirection;
  amount: Money;
  memo?: string;
  createdAt?: Date;
}

export class LedgerEntry {
  public readonly id: string;
  public readonly transactionId?: string;
  public readonly accountId: string;
  public readonly direction: EntryDirection;
  public readonly amount: Money;
  public readonly memo?: string;
  public readonly createdAt: Date;

  constructor(props: CreateLedgerEntryProps) {
    if (!props.id || typeof props.id !== 'string' || props.id.trim() === '') {
      throw new InvalidLedgerEntryError('LedgerEntry id must be a non-empty string');
    }
    if (!props.accountId || typeof props.accountId !== 'string' || props.accountId.trim() === '') {
      throw new InvalidLedgerEntryError('LedgerEntry accountId must be a non-empty string');
    }
    if (!props.amount || !(props.amount instanceof Money)) {
      throw new InvalidLedgerEntryError('LedgerEntry amount must be a valid Money instance');
    }
    if (!props.amount.isPositive()) {
      throw new InvalidLedgerEntryError(
        `LedgerEntry amount must be strictly positive (> 0), received ${props.amount.amount.toString()}`,
      );
    }

    this.id = props.id.trim();
    this.transactionId = props.transactionId?.trim();
    this.accountId = props.accountId.trim();
    this.direction = props.direction;
    this.amount = props.amount;
    this.memo = props.memo?.trim();
    this.createdAt = props.createdAt ?? new Date();

    Object.freeze(this);
  }

  public withTransactionId(transactionId: string): LedgerEntry {
    return new LedgerEntry({
      id: this.id,
      transactionId,
      accountId: this.accountId,
      direction: this.direction,
      amount: this.amount,
      memo: this.memo,
      createdAt: this.createdAt,
    });
  }
}
