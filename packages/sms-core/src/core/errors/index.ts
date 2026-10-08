export abstract class SmsPlatformError extends Error {
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

export class SmsValidationError extends SmsPlatformError {
  public override readonly code: string = 'SMS_VALIDATION_ERROR';

  constructor(message: string, details?: Record<string, unknown>, cause?: Error | unknown) {
    super(message, 400, details, cause);
  }
}

export class SmsProviderError extends SmsPlatformError {
  public override readonly code: string = 'SMS_PROVIDER_ERROR';

  constructor(
    message: string,
    public readonly providerId?: string,
    public readonly providerErrorCode?: string | number,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, 502, { ...details, providerId, providerErrorCode }, cause);
  }
}

export class SmsProviderNotFoundError extends SmsPlatformError {
  public override readonly code: string = 'SMS_PROVIDER_NOT_FOUND_ERROR';

  constructor(providerId: string, details?: Record<string, unknown>, cause?: Error | unknown) {
    super(
      `SMS provider '${providerId}' was not found in the registry`,
      404,
      { ...details, providerId },
      cause,
    );
  }
}

export class SmsProviderDisabledError extends SmsPlatformError {
  public override readonly code: string = 'SMS_PROVIDER_DISABLED_ERROR';

  constructor(providerId: string, details?: Record<string, unknown>, cause?: Error | unknown) {
    super(
      `SMS provider '${providerId}' is currently disabled`,
      422,
      { ...details, providerId },
      cause,
    );
  }
}

export class UnsupportedSmsCapabilityError extends SmsPlatformError {
  public override readonly code: string = 'UNSUPPORTED_SMS_CAPABILITY_ERROR';

  constructor(
    providerId: string,
    capability: string,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(
      `SMS provider '${providerId}' does not support requested capability: '${capability}'`,
      422,
      {
        ...details,
        providerId,
        capability,
      },
      cause,
    );
  }
}

export class SmsConfigurationError extends SmsPlatformError {
  public override readonly code: string = 'SMS_CONFIGURATION_ERROR';

  constructor(message: string, details?: Record<string, unknown>, cause?: Error | unknown) {
    super(message, 500, details, cause);
  }
}

export class SmsMessageError extends SmsPlatformError {
  public override readonly code: string = 'SMS_MESSAGE_ERROR';

  constructor(
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(message, statusCode, details, cause);
  }
}

export class InvalidSmsStateError extends SmsMessageError {
  public override readonly code: string = 'INVALID_SMS_STATE_ERROR';

  constructor(
    currentStatus: string,
    targetStatus: string,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(
      `Invalid SMS status transition from '${currentStatus}' to '${targetStatus}'`,
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
