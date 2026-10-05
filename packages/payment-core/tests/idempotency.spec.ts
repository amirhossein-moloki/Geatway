import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryIdempotencyStore } from '../src/core/idempotency/idempotency-store.interface.js';

describe('InMemoryIdempotencyStore', () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
  });

  it('should set and get values', async () => {
    await store.set('key_1', { paymentId: 'pay_123' });
    const result = await store.get<{ paymentId: string }>('key_1');
    expect(result).toEqual({ paymentId: 'pay_123' });
    expect(await store.has('key_1')).toBe(true);
  });

  it('should return null for non-existent key', async () => {
    expect(await store.get('missing')).toBeNull();
    expect(await store.has('missing')).toBe(false);
  });

  it('should delete keys', async () => {
    await store.set('key_1', 'val');
    expect(await store.delete('key_1')).toBe(true);
    expect(await store.has('key_1')).toBe(false);
  });

  it('should expire keys based on TTL', async () => {
    await store.set('key_ttl', 'val', 0.05); // 50ms TTL
    expect(await store.get('key_ttl')).toBe('val');
    await new Promise((res) => setTimeout(res, 60));
    expect(await store.get('key_ttl')).toBeNull();
  });
});
