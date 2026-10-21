import { describe, expect, it } from 'vitest';
import {
  InvalidCategoryError,
  InvalidTicketStateError,
  TenantMismatchError,
  TicketNotFoundError,
  UnauthorizedAccessError,
} from '../src/errors/ticketing.errors.js';

describe('Ticketing Domain Errors', () => {
  it('should instantiate TicketNotFoundError with 404 status code', () => {
    const err = new TicketNotFoundError('t-123', 'tenant-a');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('TICKET_NOT_FOUND_ERROR');
    expect(err.message).toContain('t-123');
  });

  it('should instantiate TenantMismatchError with 403 status code', () => {
    const err = new TenantMismatchError('tenant-a', 'tenant-b');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('TENANT_MISMATCH_ERROR');
  });

  it('should instantiate UnauthorizedAccessError with 403 status code', () => {
    const err = new UnauthorizedAccessError('Not allowed');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('UNAUTHORIZED_ACCESS_ERROR');
  });

  it('should instantiate InvalidTicketStateError with 400 status code', () => {
    const err = new InvalidTicketStateError('OPEN', 'CLOSED');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('INVALID_TICKET_STATE_ERROR');
  });

  it('should serialize error to JSON format correctly', () => {
    const err = new InvalidCategoryError('Bad category');
    const json = err.toJSON();
    expect(json).toHaveProperty('error');
    expect(json.error).toMatchObject({
      code: 'INVALID_CATEGORY_ERROR',
      statusCode: 400,
      message: 'Bad category',
    });
  });
});
