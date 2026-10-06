export interface RetryPolicyOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

export interface PaymentServiceConfig {
  defaultTimeoutMs?: number;
  retryPolicy?: RetryPolicyOptions;
}

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
