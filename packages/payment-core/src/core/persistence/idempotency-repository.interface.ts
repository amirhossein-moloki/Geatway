import { IdempotencyRecord } from '../domain/idempotency/idempotency-record.entity.js';

export interface IdempotencyRepository {
  save(record: IdempotencyRecord): Promise<IdempotencyRecord>;
  findByScopeAndKey(scope: string, key: string): Promise<IdempotencyRecord | null>;
  update(record: IdempotencyRecord): Promise<IdempotencyRecord>;
  delete(scope: string, key: string): Promise<boolean>;
}
