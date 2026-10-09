import { describe, expect, it } from 'vitest';
import { CurrencyMismatchError, InvalidAmountError, Money } from '../src/index.js';

describe('Money Value Object', () => {
  it('should create Money from minor units using bigint', () => {
    const money = Money.fromMinor(1000n, 'USD');
    expect(money.amount).toBe(1000n);
    expect(money.currency).toBe('USD');
  });

  it('should normalize currency codes to uppercase', () => {
    const money = Money.fromMinor(500n, 'irr');
    expect(money.currency).toBe('IRR');
  });

  it('should perform exact addition and subtraction', () => {
    const m1 = Money.fromMinor(1000n, 'IRR');
    const m2 = Money.fromMinor(500n, 'IRR');

    const sum = m1.add(m2);
    expect(sum.amount).toBe(1500n);
    expect(sum.currency).toBe('IRR');

    const diff = m1.subtract(m2);
    expect(diff.amount).toBe(500n);
    expect(diff.currency).toBe('IRR');
  });

  it('should reject addition/subtraction across different currencies', () => {
    const irr = Money.fromMinor(1000n, 'IRR');
    const usd = Money.fromMinor(1000n, 'USD');

    expect(() => irr.add(usd)).toThrow(CurrencyMismatchError);
    expect(() => irr.subtract(usd)).toThrow(CurrencyMismatchError);
    expect(() => irr.compare(usd)).toThrow(CurrencyMismatchError);
  });

  it('should reject invalid amount inputs and floats for minor units', () => {
    expect(() => Money.fromMinor(12.34 as unknown as number, 'USD')).toThrow(InvalidAmountError);
    expect(() => Money.fromMinor('abc', 'USD')).toThrow(InvalidAmountError);
    expect(() => Money.fromMinor('12.34', 'USD')).toThrow(InvalidAmountError);
    expect(() => new Money(100n, '')).toThrow(InvalidAmountError);
  });

  it('should handle zero and negative amounts without implicit rounding', () => {
    const zero = Money.zero('USD');
    expect(zero.isZero()).toBe(true);
    expect(zero.isPositive()).toBe(false);

    const pos = Money.fromMinor(100n, 'USD');
    expect(pos.isPositive()).toBe(true);

    const neg = Money.fromMinor(-100n, 'USD');
    expect(neg.isNegative()).toBe(true);

    const res = pos.subtract(Money.fromMinor(200n, 'USD'));
    expect(res.amount).toBe(-100n);
    expect(res.isNegative()).toBe(true);
  });

  it('should support large bigint amounts without precision loss', () => {
    const largeAmount = 9_007_199_254_740_991_000n; // larger than Number.MAX_SAFE_INTEGER
    const m1 = Money.fromMinor(largeAmount, 'IRR');
    const m2 = Money.fromMinor(1000n, 'IRR');

    const sum = m1.add(m2);
    expect(sum.amount).toBe(9_007_199_254_740_992_000n);
  });

  it('should safely parse and format major units without floating point math', () => {
    const m1 = Money.fromMajor('10.50', 'USD', 2);
    expect(m1.amount).toBe(1050n);
    expect(m1.toMajor(2)).toBe('10.50');

    const m2 = Money.fromMajor('1000', 'IRR', 0);
    expect(m2.amount).toBe(1000n);
    expect(m2.toMajor(0)).toBe('1000');

    expect(() => Money.fromMajor('10.555', 'USD', 2)).toThrow(InvalidAmountError);
  });

  it('should serialize correctly to JSON', () => {
    const money = Money.fromMinor(2500n, 'USD');
    expect(money.toJSON()).toEqual({ amount: '2500', currency: 'USD' });
  });
});
