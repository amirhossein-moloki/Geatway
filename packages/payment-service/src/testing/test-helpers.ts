import { GatewayRegistry } from '@company/payment-core';
import {
  InMemoryPaymentRepository,
  InMemoryTransactionRepository,
  InMemoryIdempotencyRepository,
  InMemoryWebhookEventRepository,
} from './in-memory-repositories.js';
import { TestGateway } from './test-gateway.js';
import { PaymentApplicationService } from '../payment-service.js';

export interface TestEnvironment {
  service: PaymentApplicationService;
  registry: GatewayRegistry;
  gateway: TestGateway;
  paymentRepo: InMemoryPaymentRepository;
  transactionRepo: InMemoryTransactionRepository;
  idempotencyRepo: InMemoryIdempotencyRepository;
  webhookRepo: InMemoryWebhookEventRepository;
}

export function createTestPaymentService(customGateway?: TestGateway): TestEnvironment {
  const registry = new GatewayRegistry();
  const gateway = customGateway || new TestGateway();
  registry.register(gateway);

  const paymentRepo = new InMemoryPaymentRepository();
  const transactionRepo = new InMemoryTransactionRepository();
  const idempotencyRepo = new InMemoryIdempotencyRepository();
  const webhookRepo = new InMemoryWebhookEventRepository();

  const service = new PaymentApplicationService({
    registry,
    paymentRepository: paymentRepo,
    transactionRepository: transactionRepo,
    idempotencyRepository: idempotencyRepo,
    webhookEventRepository: webhookRepo,
  });

  return {
    service,
    registry,
    gateway,
    paymentRepo,
    transactionRepo,
    idempotencyRepo,
    webhookRepo,
  };
}
