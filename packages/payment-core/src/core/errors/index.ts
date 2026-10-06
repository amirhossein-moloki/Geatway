export abstract class PaymentPlatformError extends Error {
  public abstract readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public override readonly cause?: Error | unknown;

  constructor(
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends PaymentPlatformError {
  public override readonly code: string = 'VALIDATION_ERROR';

  constructor(message: string, details?: Record<string, unknown>, cause?: Error | unknown) {
    super(message, 400, details, cause);
  }
}

export class GatewayError extends PaymentPlatformError {
  public override readonly code: string = 'GATEWAY_ERROR';

  constructor(
    message: string,
    public readonly gatewayId?: string,
    public readonly providerErrorCode?: string | number,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, 502, { ...details, gatewayId, providerErrorCode }, cause);
  }
}

export class GatewayNotFoundError extends PaymentPlatformError {
  public override readonly code: string = 'GATEWAY_NOT_FOUND_ERROR';

  constructor(gatewayId: string, details?: Record<string, unknown>, cause?: Error | unknown) {
    super(
      `Gateway '${gatewayId}' was not found in the registry`,
      404,
      { ...details, gatewayId },
      cause,
    );
  }
}

export class GatewayDisabledError extends PaymentPlatformError {
  public override readonly code: string = 'GATEWAY_DISABLED_ERROR';

  constructor(gatewayId: string, details?: Record<string, unknown>, cause?: Error | unknown) {
    super(`Gateway '${gatewayId}' is currently disabled`, 422, { ...details, gatewayId }, cause);
  }
}

export class UnsupportedCapabilityError extends PaymentPlatformError {
  public override readonly code: string = 'UNSUPPORTED_CAPABILITY_ERROR';

  constructor(
    gatewayId: string,
    capability: string,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(
      `Gateway '${gatewayId}' does not support requested capability: '${capability}'`,
      422,
      {
        ...details,
        gatewayId,
        capability,
      },
      cause,
    );
  }
}

export class PaymentError extends PaymentPlatformError {
  public override readonly code: string = 'PAYMENT_ERROR';

  constructor(
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, statusCode, details, cause);
  }
}

export class InvalidPaymentStateError extends PaymentError {
  public override readonly code: string = 'INVALID_PAYMENT_STATE_ERROR';

  constructor(
    currentStatus: string,
    targetStatus: string,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(
      `Invalid payment status transition from '${currentStatus}' to '${targetStatus}'`,
      400,
      {
        ...details,
        currentStatus,
        targetStatus,
      },
      cause,
    );
  }
}

export const InvalidStateTransitionError = InvalidPaymentStateError;
export type InvalidStateTransitionError = InvalidPaymentStateError;

export class TransactionError extends PaymentPlatformError {
  public override readonly code: string = 'TRANSACTION_ERROR';

  constructor(
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, statusCode, details, cause);
  }
}

export class ConfigurationError extends PaymentPlatformError {
  public override readonly code: string = 'CONFIGURATION_ERROR';

  constructor(message: string, details?: Record<string, unknown>, cause?: Error | unknown) {
    super(message, 500, details, cause);
  }
}

export class PersistenceError extends PaymentPlatformError {
  public override readonly code: string = 'PERSISTENCE_ERROR';

  constructor(
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, statusCode, details, cause);
  }
}

export class PersistenceConflictError extends PersistenceError {
  public override readonly code: string = 'PERSISTENCE_CONFLICT_ERROR';

  constructor(message: string, details?: Record<string, unknown>, cause?: Error | unknown) {
    super(message, 409, details, cause);
  }
}

export class RepositoryNotFoundError extends PersistenceError {
  public override readonly code: string = 'REPOSITORY_NOT_FOUND_ERROR';

  constructor(
    entityName: string,
    id: string,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(
      `${entityName} with id '${id}' was not found`,
      404,
      { ...details, entityName, id },
      cause,
    );
  }
}

export class ConcurrencyError extends PersistenceError {
  public override readonly code: string = 'CONCURRENCY_ERROR';

  constructor(
    message = 'Optimistic concurrency check failed: entity was modified concurrently',
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, 409, details, cause);
  }
}

export class PersistenceUnavailableError extends PersistenceError {
  public override readonly code: string = 'PERSISTENCE_UNAVAILABLE_ERROR';

  constructor(
    message = 'Database or persistence service is currently unavailable',
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, 503, details, cause);
  }
}
