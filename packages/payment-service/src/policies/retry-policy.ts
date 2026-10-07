import { RetryPolicyOptions } from '../configuration.js';
import {
  ValidationError,
  GatewayNotFoundError,
  GatewayDisabledError,
  UnsupportedCapabilityError,
  InvalidPaymentStateError,
  PersistenceConflictError,
  ConcurrencyError,
  PaymentPlatformError,
} from '@amirhossein-moloki/payment-core';

export class RetryPolicy {
  private readonly maxAttempts: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly backoffFactor: number;
  private readonly jitter: boolean;

  constructor(options?: RetryPolicyOptions) {
    this.maxAttempts = options?.maxAttempts ?? 1;
    this.initialDelayMs = options?.initialDelayMs ?? 100;
    this.maxDelayMs = options?.maxDelayMs ?? 2000;
    this.backoffFactor = options?.backoffFactor ?? 2;
    this.jitter = options?.jitter ?? true;
  }

  public isRetryableError(error: unknown): boolean {
    if (!error) {
      return false;
    }

    if (
      error instanceof ValidationError ||
      error instanceof GatewayNotFoundError ||
      error instanceof GatewayDisabledError ||
      error instanceof UnsupportedCapabilityError ||
      error instanceof InvalidPaymentStateError ||
      error instanceof PersistenceConflictError ||
      error instanceof ConcurrencyError
    ) {
      return false;
    }

    if (error instanceof PaymentPlatformError) {
      return error.statusCode >= 500 || error.statusCode === 429;
    }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      const code = (error as { code?: string }).code;
      if (
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'ENOTFOUND' ||
        code === 'ECONNREFUSED' ||
        msg.includes('network') ||
        msg.includes('timeout') ||
        msg.includes('fetch failed')
      ) {
        return true;
      }
    }

    return false;
  }

  public async execute<T>(fn: () => Promise<T>, customOptions?: RetryPolicyOptions): Promise<T> {
    const maxAttempts = customOptions?.maxAttempts ?? this.maxAttempts;
    const initialDelay = customOptions?.initialDelayMs ?? this.initialDelayMs;
    const maxDelay = customOptions?.maxDelayMs ?? this.maxDelayMs;
    const factor = customOptions?.backoffFactor ?? this.backoffFactor;
    const useJitter = customOptions?.jitter ?? this.jitter;

    let attempt = 0;
    let currentDelay = initialDelay;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        return await fn();
      } catch (error) {
        if (attempt >= maxAttempts || !this.isRetryableError(error)) {
          throw error;
        }

        let delay = currentDelay;
        if (useJitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        currentDelay = Math.min(currentDelay * factor, maxDelay);
      }
    }

    throw new Error('RetryPolicy failed without executing operation');
  }
}
