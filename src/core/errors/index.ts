export abstract class PaymentPlatformError extends Error {
  public abstract readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, statusCode = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
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

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, details);
  }
}

export class GatewayError extends PaymentPlatformError {
  public override readonly code: string = 'GATEWAY_ERROR';

  constructor(
    message: string,
    public readonly gatewayId?: string,
    public readonly providerErrorCode?: string | number,
    details?: Record<string, unknown>,
  ) {
    super(message, 502, { ...details, gatewayId, providerErrorCode });
  }
}

export class GatewayNotFoundError extends PaymentPlatformError {
  public override readonly code: string = 'GATEWAY_NOT_FOUND_ERROR';

  constructor(gatewayId: string, details?: Record<string, unknown>) {
    super(`Gateway '${gatewayId}' was not found in the registry`, 404, { ...details, gatewayId });
  }
}

export class GatewayDisabledError extends PaymentPlatformError {
  public override readonly code: string = 'GATEWAY_DISABLED_ERROR';

  constructor(gatewayId: string, details?: Record<string, unknown>) {
    super(`Gateway '${gatewayId}' is currently disabled`, 422, { ...details, gatewayId });
  }
}

export class UnsupportedCapabilityError extends PaymentPlatformError {
  public override readonly code: string = 'UNSUPPORTED_CAPABILITY_ERROR';

  constructor(gatewayId: string, capability: string, details?: Record<string, unknown>) {
    super(`Gateway '${gatewayId}' does not support requested capability: '${capability}'`, 422, {
      ...details,
      gatewayId,
      capability,
    });
  }
}

export class PaymentError extends PaymentPlatformError {
  public override readonly code: string = 'PAYMENT_ERROR';

  constructor(message: string, statusCode = 400, details?: Record<string, unknown>) {
    super(message, statusCode, details);
  }
}

export class InvalidStateTransitionError extends PaymentError {
  public override readonly code: string = 'INVALID_STATE_TRANSITION_ERROR';

  constructor(currentStatus: string, targetStatus: string, details?: Record<string, unknown>) {
    super(`Invalid payment status transition from '${currentStatus}' to '${targetStatus}'`, 400, {
      ...details,
      currentStatus,
      targetStatus,
    });
  }
}

export class TransactionError extends PaymentPlatformError {
  public override readonly code: string = 'TRANSACTION_ERROR';

  constructor(message: string, statusCode = 400, details?: Record<string, unknown>) {
    super(message, statusCode, details);
  }
}

export class ConfigurationError extends PaymentPlatformError {
  public override readonly code: string = 'CONFIGURATION_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 500, details);
  }
}
