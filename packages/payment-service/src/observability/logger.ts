export interface PaymentLogger {
  debug?(message: string, context?: Record<string, unknown>): void;
  info?(message: string, context?: Record<string, unknown>): void;
  warn?(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}

const SENSITIVE_KEYS = new Set([
  'cardnumber',
  'card_number',
  'pan',
  'cvv',
  'cvv2',
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'privatekey',
  'private_key',
  'merchantid',
  'terminalid',
  'pin',
]);

export function sanitizeContext(
  context?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!context) {
    return undefined;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(normalizedKey)) {
      result[key] = '[REDACTED]';
    } else if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export class NoopLogger implements PaymentLogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
}

export class ConsoleLogger implements PaymentLogger {
  public debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[DEBUG] ${message}`, sanitizeContext(context) || '');
  }

  public info(message: string, context?: Record<string, unknown>): void {
    console.info(`[INFO] ${message}`, sanitizeContext(context) || '');
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, sanitizeContext(context) || '');
  }

  public error(message: string, context?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, sanitizeContext(context) || '');
  }
}
