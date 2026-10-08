export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  GATEWAY_ERROR = 'GATEWAY_ERROR',
  GATEWAY_NOT_FOUND = 'GATEWAY_NOT_FOUND',
  GATEWAY_DISABLED = 'GATEWAY_DISABLED',
  UNSUPPORTED_CAPABILITY = 'UNSUPPORTED_CAPABILITY',
  PAYMENT_ERROR = 'PAYMENT_ERROR',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

export class PaymentPlatformError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Readonly<Record<string, unknown>> | undefined;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details ? Object.freeze({ ...details }) : undefined;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends PaymentPlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

export class GatewayNotFoundError extends PaymentPlatformError {
  constructor(gatewayId: string) {
    super(`Gateway with ID '${gatewayId}' was not found.`, ErrorCode.GATEWAY_NOT_FOUND, 444, {
      gatewayId,
    });
  }
}

export class GatewayDisabledError extends PaymentPlatformError {
  constructor(gatewayId: string) {
    super(
      `Gateway with ID '${gatewayId}' is currently disabled.`,
      ErrorCode.GATEWAY_DISABLED,
      422,
      { gatewayId },
    );
  }
}

export class UnsupportedCapabilityError extends PaymentPlatformError {
  constructor(gatewayId: string, capability: string) {
    super(
      `Gateway '${gatewayId}' does not support capability '${capability}'.`,
      ErrorCode.UNSUPPORTED_CAPABILITY,
      422,
      { gatewayId, capability },
    );
  }
}

export class GatewayError extends PaymentPlatformError {
  public readonly providerCode?: string | undefined;

  constructor(message: string, providerCode?: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.GATEWAY_ERROR, 502, { ...details, providerCode });
    this.providerCode = providerCode;
  }
}

export class PaymentError extends PaymentPlatformError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PAYMENT_ERROR,
    details?: Record<string, unknown>,
  ) {
    super(message, code, 400, details);
  }
}

export class TransactionError extends PaymentPlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.TRANSACTION_ERROR, 400, details);
  }
}

export class ConfigurationError extends PaymentPlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.CONFIGURATION_ERROR, 500, details);
  }
}
