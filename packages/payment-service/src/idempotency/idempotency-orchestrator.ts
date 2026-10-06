import { createHash } from 'crypto';
import {
  IdempotencyRepository,
  IdempotencyRecord,
  IdempotencyStatus,
  PersistenceConflictError,
  ConcurrencyError,
} from '@company/payment-core';

export class IdempotencyOrchestrator {
  constructor(private readonly repository?: IdempotencyRepository) {}

  public static computeHash(payload: unknown): string {
    const jsonString = JSON.stringify(payload ?? {}, Object.keys((payload as object) || {}).sort());
    return createHash('sha256').update(jsonString).digest('hex');
  }

  public async executeIdempotent<T>(
    scope: string,
    key: string | undefined,
    payload: unknown,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!key || !this.repository) {
      return fn();
    }

    const requestHash = IdempotencyOrchestrator.computeHash(payload);
    const existing = await this.repository.findByScopeAndKey(scope, key);

    if (existing) {
      if (existing.isExpired()) {
        await this.repository.delete(scope, key);
      } else if (existing.status === IdempotencyStatus.COMPLETED) {
        if (existing.requestHash !== requestHash) {
          throw new PersistenceConflictError(
            `Idempotency key '${key}' in scope '${scope}' was previously used with a different request payload`,
            { scope, key },
          );
        }
        return existing.result as T;
      } else if (existing.status === IdempotencyStatus.PENDING) {
        throw new ConcurrencyError(
          `Operation with idempotency key '${key}' in scope '${scope}' is currently in progress`,
          { scope, key },
        );
      }
    }

    const pendingRecord = new IdempotencyRecord({
      scope,
      key,
      requestHash,
      status: IdempotencyStatus.PENDING,
    });

    await this.repository.save(pendingRecord);

    try {
      const result = await fn();

      const completedRecord = new IdempotencyRecord({
        id: pendingRecord.id,
        scope,
        key,
        requestHash,
        status: IdempotencyStatus.COMPLETED,
        result: JSON.parse(JSON.stringify(result ?? {})),
        createdAt: pendingRecord.createdAt,
      });

      await this.repository.update(completedRecord);
      return result;
    } catch (error) {
      try {
        const failedRecord = new IdempotencyRecord({
          id: pendingRecord.id,
          scope,
          key,
          requestHash,
          status: IdempotencyStatus.FAILED,
          result: { error: error instanceof Error ? error.message : String(error) },
          createdAt: pendingRecord.createdAt,
        });
        await this.repository.update(failedRecord);
      } catch {
        // Ignore update failure
      }
      throw error;
    }
  }
}
