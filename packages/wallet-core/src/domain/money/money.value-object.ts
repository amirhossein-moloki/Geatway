import { CurrencyMismatchError, InvalidAmountError } from '../../errors/wallet.errors.js';

export class Money {
  public readonly amount: bigint;
  public readonly currency: string;

  constructor(amount: bigint, currency: string) {
    if (!currency || typeof currency !== 'string' || currency.trim() === '') {
      throw new InvalidAmountError('Currency code must be a non-empty string');
    }
    this.amount = amount;
    this.currency = currency.trim().toUpperCase();
    Object.freeze(this);
  }

  public static fromMinor(amount: bigint | number | string, currency: string): Money {
    let parsedAmount: bigint;
    if (typeof amount === 'bigint') {
      parsedAmount = amount;
    } else if (typeof amount === 'number') {
      if (!Number.isInteger(amount)) {
        throw new InvalidAmountError(
          `Minor unit amount must be an integer, received float: ${amount}`,
        );
      }
      if (!Number.isSafeInteger(amount)) {
        throw new InvalidAmountError(
          `Number ${amount} is not a safe integer; use bigint or string instead`,
        );
      }
      parsedAmount = BigInt(amount);
    } else if (typeof amount === 'string') {
      const trimmed = amount.trim();
      if (!/^-?\d+$/.test(trimmed)) {
        throw new InvalidAmountError(
          `Minor unit string must be an integer string, received: '${amount}'`,
        );
      }
      try {
        parsedAmount = BigInt(trimmed);
      } catch (err) {
        throw new InvalidAmountError(`Invalid integer amount string: '${amount}'`, { cause: err });
      }
    } else {
      throw new InvalidAmountError(`Invalid amount type: ${typeof amount}`);
    }

    return new Money(parsedAmount, currency);
  }

  public static fromMajor(amount: number | string, currency: string, decimals = 0): Money {
    if (!Number.isInteger(decimals) || decimals < 0) {
      throw new InvalidAmountError(
        `Decimals must be a non-negative integer, received: ${decimals}`,
      );
    }

    const strAmount = typeof amount === 'number' ? amount.toString() : amount.trim();
    if (!/^-?\d+(\.\d+)?$/.test(strAmount)) {
      throw new InvalidAmountError(`Invalid decimal amount format: '${strAmount}'`);
    }

    const isNegative = strAmount.startsWith('-');
    const cleanStr = isNegative ? strAmount.slice(1) : strAmount;
    const parts = cleanStr.split('.');
    const integerPart = parts[0] ?? '0';
    let fractionalPart = parts[1] ?? '';

    if (fractionalPart.length > decimals) {
      throw new InvalidAmountError(
        `Amount '${strAmount}' has ${fractionalPart.length} decimal places, exceeding configured decimals (${decimals}) without rounding`,
      );
    }

    fractionalPart = fractionalPart.padEnd(decimals, '0');
    const combinedStr = integerPart + fractionalPart;
    const minorBigInt = BigInt(combinedStr);
    const signedAmount = isNegative ? -minorBigInt : minorBigInt;

    return new Money(signedAmount, currency);
  }

  public static zero(currency: string): Money {
    return new Money(0n, currency);
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  public multiply(factor: bigint | number): Money {
    let multiplier: bigint;
    if (typeof factor === 'bigint') {
      multiplier = factor;
    } else if (typeof factor === 'number') {
      if (!Number.isInteger(factor)) {
        throw new InvalidAmountError(
          `Multiplication factor must be an integer, received float: ${factor}`,
        );
      }
      multiplier = BigInt(factor);
    } else {
      throw new InvalidAmountError(`Invalid factor type: ${typeof factor}`);
    }
    return new Money(this.amount * multiplier, this.currency);
  }

  public equals(other: Money): boolean {
    return this.currency === other.currency.toUpperCase() && this.amount === other.amount;
  }

  public compare(other: Money): number {
    this.assertSameCurrency(other);
    if (this.amount < other.amount) return -1;
    if (this.amount > other.amount) return 1;
    return 0;
  }

  public isZero(): boolean {
    return this.amount === 0n;
  }

  public isPositive(): boolean {
    return this.amount > 0n;
  }

  public isNegative(): boolean {
    return this.amount < 0n;
  }

  public isGreaterThan(other: Money): boolean {
    return this.compare(other) > 0;
  }

  public isLessThan(other: Money): boolean {
    return this.compare(other) < 0;
  }

  public toMajor(decimals = 0): string {
    if (!Number.isInteger(decimals) || decimals < 0) {
      throw new InvalidAmountError(
        `Decimals must be a non-negative integer, received: ${decimals}`,
      );
    }

    const isNegative = this.amount < 0n;
    const absAmount = isNegative ? -this.amount : this.amount;
    const strAbs = absAmount.toString();

    if (decimals === 0) {
      return (isNegative ? '-' : '') + strAbs;
    }

    const padded = strAbs.padStart(decimals + 1, '0');
    const integerPart = padded.slice(0, padded.length - decimals);
    const fractionalPart = padded.slice(padded.length - decimals);

    return `${isNegative ? '-' : ''}${integerPart}.${fractionalPart}`;
  }

  public assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency.toUpperCase()) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  public toJSON(): { amount: string; currency: string } {
    return {
      amount: this.amount.toString(),
      currency: this.currency,
    };
  }
}
