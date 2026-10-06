import { PaymentPlatformError } from '@company/payment-core';

export class OperationTimeoutError extends PaymentPlatformError {
  public override readonly code: string = 'OPERATION_TIMEOUT_ERROR';

  constructor(
    operationName: string,
    timeoutMs: number,
    details?: Record<string, unknown>,
    cause?: Error | unknown,
  ) {
    super(
      `Operation '${operationName}' timed out after ${timeoutMs}ms. Provider outcome is uncertain.`,
      504,
      { ...details, operationName, timeoutMs, isUncertainOutcome: true },
      cause,
    );
  }
}

export class TimeoutPolicy {
  public static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName = 'Payment Operation',
  ): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) {
      return promise;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new OperationTimeoutError(operationName, timeoutMs));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
