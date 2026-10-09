import { EntryDirection } from './entry-direction.enum.js';
import { LedgerEntry } from './ledger-entry.entity.js';
import { TransactionStatus } from './transaction-status.enum.js';
import { Money } from '../money/money.value-object.js';
import {
  CurrencyMismatchError,
  EmptyTransactionError,
  ImmutableTransactionError,
  InvalidWalletStateError,
  UnbalancedTransactionError,
} from '../../errors/wallet.errors.js';

export interface CreateLedgerTransactionProps {
  id: string;
  description: string;
  idempotencyKey?: string;
  reference?: string;
  entries?: LedgerEntry[];
  metadata?: Record<string, unknown>;
}

export interface LedgerTransactionProps extends CreateLedgerTransactionProps {
  status: TransactionStatus;
  entries: LedgerEntry[];
  createdAt: Date;
  postedAt?: Date;
}

export class LedgerTransaction {
  public readonly id: string;
  public readonly description: string;
  public readonly idempotencyKey?: string;
  public readonly reference?: string;
  private _status: TransactionStatus;
  private _entries: LedgerEntry[];
  public readonly createdAt: Date;
  private _postedAt?: Date;
  public readonly metadata?: Record<string, unknown>;

  constructor(props: LedgerTransactionProps) {
    if (!props.id || typeof props.id !== 'string' || props.id.trim() === '') {
      throw new Error('LedgerTransaction id must be a non-empty string');
    }
    if (
      !props.description ||
      typeof props.description !== 'string' ||
      props.description.trim() === ''
    ) {
      throw new Error('LedgerTransaction description must be a non-empty string');
    }

    this.id = props.id.trim();
    this.description = props.description.trim();
    this.idempotencyKey = props.idempotencyKey?.trim();
    this.reference = props.reference?.trim();
    this._status = props.status;
    this._entries = props.entries.map((entry) => entry.withTransactionId(this.id));
    this.createdAt = props.createdAt;
    this._postedAt = props.postedAt;
    this.metadata = props.metadata ? { ...props.metadata } : undefined;

    if (this._status === TransactionStatus.POSTED) {
      Object.freeze(this._entries);
    }
  }

  public static draft(props: CreateLedgerTransactionProps): LedgerTransaction {
    return new LedgerTransaction({
      ...props,
      entries: props.entries ?? [],
      status: TransactionStatus.DRAFT,
      createdAt: new Date(),
    });
  }

  public get status(): TransactionStatus {
    return this._status;
  }

  public get postedAt(): Date | undefined {
    return this._postedAt;
  }

  public get entries(): readonly LedgerEntry[] {
    return this._entries;
  }

  public addEntry(entry: LedgerEntry): void {
    if (this._status !== TransactionStatus.DRAFT) {
      throw new ImmutableTransactionError(
        this.id,
        `Cannot add entry to transaction '${this.id}' with status '${this._status}'`,
      );
    }
    this._entries.push(entry.withTransactionId(this.id));
  }

  public getCurrency(): string {
    if (this._entries.length === 0) {
      throw new EmptyTransactionError(
        `Transaction '${this.id}' has no entries to determine currency`,
      );
    }
    const currency = this._entries[0]!.amount.currency;
    for (const entry of this._entries) {
      if (entry.amount.currency !== currency) {
        throw new CurrencyMismatchError(currency, entry.amount.currency);
      }
    }
    return currency;
  }

  public calculateTotals(): { debits: Money; credits: Money; currency: string } {
    if (this._entries.length === 0) {
      throw new EmptyTransactionError(
        `Transaction '${this.id}' has no entries to calculate totals`,
      );
    }

    const currency = this.getCurrency();
    let totalDebits = Money.zero(currency);
    let totalCredits = Money.zero(currency);

    for (const entry of this._entries) {
      if (entry.direction === EntryDirection.DEBIT) {
        totalDebits = totalDebits.add(entry.amount);
      } else if (entry.direction === EntryDirection.CREDIT) {
        totalCredits = totalCredits.add(entry.amount);
      }
    }

    return { debits: totalDebits, credits: totalCredits, currency };
  }

  public validate(): void {
    if (this._entries.length < 2) {
      throw new EmptyTransactionError(
        `Transaction '${this.id}' must contain at least 2 entries (debit & credit), found ${this._entries.length}`,
      );
    }

    const { debits, credits, currency } = this.calculateTotals();

    if (!debits.equals(credits)) {
      throw new UnbalancedTransactionError(
        debits.amount.toString(),
        credits.amount.toString(),
        currency,
        { transactionId: this.id },
      );
    }
  }

  public post(): void {
    if (this._status === TransactionStatus.POSTED) {
      throw new ImmutableTransactionError(this.id);
    }
    if (this._status === TransactionStatus.REJECTED) {
      throw new InvalidWalletStateError(this._status, TransactionStatus.POSTED, {
        transactionId: this.id,
        reason: 'Cannot post a rejected transaction',
      });
    }

    this.validate();

    this._status = TransactionStatus.POSTED;
    this._postedAt = new Date();
    Object.freeze(this._entries);
  }

  public createCompensatingTransaction(
    newTransactionId: string,
    description: string,
    idempotencyKey?: string,
  ): LedgerTransaction {
    if (this._status !== TransactionStatus.POSTED) {
      throw new InvalidWalletStateError(this._status, TransactionStatus.DRAFT, {
        transactionId: this.id,
        reason: 'Can only create a compensating transaction for a POSTED transaction',
      });
    }

    const reversedEntries = this._entries.map((entry, index) => {
      const reversedDirection =
        entry.direction === EntryDirection.DEBIT ? EntryDirection.CREDIT : EntryDirection.DEBIT;

      return new LedgerEntry({
        id: `${newTransactionId}-rev-${index + 1}`,
        accountId: entry.accountId,
        direction: reversedDirection,
        amount: entry.amount,
        memo: `Compensating entry for transaction ${this.id} (${entry.id}): ${entry.memo ?? ''}`.trim(),
      });
    });

    return LedgerTransaction.draft({
      id: newTransactionId,
      description,
      idempotencyKey,
      reference: this.id,
      entries: reversedEntries,
      metadata: {
        compensatesTransactionId: this.id,
      },
    });
  }
}
