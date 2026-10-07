import { PaymentApplicationService } from '@amirhossein-moloki/payment-service';
import {
  InMemoryPaymentRepository,
  InMemoryTransactionRepository,
  InMemoryIdempotencyRepository,
  InMemoryWebhookEventRepository,
} from '@amirhossein-moloki/payment-service/testing';
import { setupGatewayRegistry } from './gateway.js';

export function createPaymentApplication(): { service: PaymentApplicationService } {
  const registry = setupGatewayRegistry();

  const paymentRepository = new InMemoryPaymentRepository();
  const transactionRepository = new InMemoryTransactionRepository();
  const idempotencyRepository = new InMemoryIdempotencyRepository();
  const webhookEventRepository = new InMemoryWebhookEventRepository();

  const service = new PaymentApplicationService({
    registry,
    paymentRepository,
    transactionRepository,
    idempotencyRepository,
    webhookEventRepository,
    config: {
      defaultTimeoutMs: 10000,
      retryPolicy: {
        maxAttempts: 2,
        initialDelayMs: 100,
      },
    },
  });

  return { service };
}
