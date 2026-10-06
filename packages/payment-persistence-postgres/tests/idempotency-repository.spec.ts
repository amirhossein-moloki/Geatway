import { describe, it, expect, beforeEach } from 'vitest';
import {
  IdempotencyRecord,
  IdempotencyStatus,
  PersistenceConflictError,
} from '@company/payment-core';
import { PostgresIdempotencyRepository } from '../src/repositories/postgres-idempotency-repository.js';
import { createTestDatabase } from './test-utils.js';
import { PgExecutor } from '../src/migrator.js';

describe('PostgresIdempotencyRepository', () => {
  let db: PgExecutor;
  let idempotencyRepo: PostgresIdempotencyRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    idempotencyRepo = new PostgresIdempotencyRepository(db);
  });

  it('should save first request and retrieve it by scope and key', async () => {
    const record = new IdempotencyRecord({
      scope: 'payment_create',
      key: 'req_123',
      requestHash: 'hash_abc123',
      status: IdempotencyStatus.PENDING,
    });

    const saved = await idempotencyRepo.save(record);
    expect(saved.scope).toBe('payment_create');
    expect(saved.key).toBe('req_123');
    expect(saved.status).toBe(IdempotencyStatus.PENDING);

    const found = await idempotencyRepo.findByScopeAndKey('payment_create', 'req_123');
    expect(found).not.toBeNull();
    expect(found?.requestHash).toBe('hash_abc123');
  });

  it('should return existing record when same scope, key, and request hash are re-sent', async () => {
    const record1 = new IdempotencyRecord({
      scope: 'payment_create',
      key: 'req_123',
      requestHash: 'hash_same',
      status: IdempotencyStatus.COMPLETED,
      result: { paymentId: 'pay_777', status: 'SUCCESS' },
    });
    await idempotencyRepo.save(record1);

    const record2 = new IdempotencyRecord({
      scope: 'payment_create',
      key: 'req_123',
      requestHash: 'hash_same',
      status: IdempotencyStatus.PENDING,
    });

    const duplicateRes = await idempotencyRepo.save(record2);
    expect(duplicateRes.status).toBe(IdempotencyStatus.COMPLETED);
    expect((duplicateRes.result as { paymentId: string })?.paymentId).toBe('pay_777');
  });

  it('should reject with PersistenceConflictError when same key is used with a different request hash', async () => {
    const record1 = new IdempotencyRecord({
      scope: 'payment_create',
      key: 'req_456',
      requestHash: 'hash_original',
      status: IdempotencyStatus.COMPLETED,
    });
    await idempotencyRepo.save(record1);

    const recordConflict = new IdempotencyRecord({
      scope: 'payment_create',
      key: 'req_456',
      requestHash: 'hash_DIFFERENT',
      status: IdempotencyStatus.PENDING,
    });

    await expect(idempotencyRepo.save(recordConflict)).rejects.toThrow(PersistenceConflictError);
  });

  it('should update idempotency record result cleanly', async () => {
    const record = new IdempotencyRecord({
      scope: 'payment_authorize',
      key: 'auth_888',
      requestHash: 'hash_auth',
      status: IdempotencyStatus.PENDING,
    });
    await idempotencyRepo.save(record);

    const updated = new IdempotencyRecord({
      id: record.id,
      scope: record.scope,
      key: record.key,
      requestHash: record.requestHash,
      status: IdempotencyStatus.COMPLETED,
      result: { success: true, authorizationCode: 'AUTH_OK' },
    });

    const savedUpdated = await idempotencyRepo.update(updated);
    expect(savedUpdated.status).toBe(IdempotencyStatus.COMPLETED);
    expect((savedUpdated.result as { authorizationCode: string })?.authorizationCode).toBe(
      'AUTH_OK',
    );
  });

  it('should ignore expired idempotency records when finding by key', async () => {
    const expiredRecord = new IdempotencyRecord({
      scope: 'payment_create',
      key: 'expired_key',
      requestHash: 'hash_exp',
      status: IdempotencyStatus.COMPLETED,
      expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
    });
    await idempotencyRepo.save(expiredRecord);

    const found = await idempotencyRepo.findByScopeAndKey('payment_create', 'expired_key');
    expect(found).toBeNull();
  });

  it('should support IdempotencyStore interface operations (get, set, has, delete)', async () => {
    await idempotencyRepo.set('cache_key_1', { data: 'hello' }, 3600);

    const hasKey = await idempotencyRepo.has('cache_key_1');
    expect(hasKey).toBe(true);

    const value = await idempotencyRepo.get<{ data: string }>('cache_key_1');
    expect(value?.data).toBe('hello');

    const deleted = await idempotencyRepo.delete('cache_key_1');
    expect(deleted).toBe(true);

    const hasKeyAfter = await idempotencyRepo.has('cache_key_1');
    expect(hasKeyAfter).toBe(false);
  });
});
