import { GatewayRegistry } from '@amirhossein-moloki/payment-core';
import { PaymentApplicationService } from '@amirhossein-moloki/payment-service';
import {
  InMemoryPaymentRepository,
  InMemoryTransactionRepository,
  InMemoryIdempotencyRepository,
  InMemoryWebhookEventRepository,
} from '@amirhossein-moloki/payment-service/testing';
import { loadConfig, AppConfig } from './config.js';
import { createGatewayRegistry } from './gateway-factory.js';

export class DepixPaymentApp {
  public readonly config: AppConfig;
  public readonly registry: GatewayRegistry;
  public readonly paymentRepository: InMemoryPaymentRepository;
  public readonly transactionRepository: InMemoryTransactionRepository;
  public readonly idempotencyRepository: InMemoryIdempotencyRepository;
  public readonly webhookEventRepository: InMemoryWebhookEventRepository;
  public readonly service: PaymentApplicationService;

  constructor(customConfig?: Partial<AppConfig>) {
    this.config = { ...loadConfig(), ...customConfig };
    this.registry = createGatewayRegistry(this.config);

    this.paymentRepository = new InMemoryPaymentRepository();
    this.transactionRepository = new InMemoryTransactionRepository();
    this.idempotencyRepository = new InMemoryIdempotencyRepository();
    this.webhookEventRepository = new InMemoryWebhookEventRepository();

    this.service = new PaymentApplicationService({
      registry: this.registry,
      paymentRepository: this.paymentRepository,
      transactionRepository: this.transactionRepository,
      idempotencyRepository: this.idempotencyRepository,
      webhookEventRepository: this.webhookEventRepository,
      config: {
        defaultTimeoutMs: 15000,
        retryPolicy: {
          maxAttempts: 3,
          initialDelayMs: 200,
        },
      },
    });
  }

  public getRegisteredGateways(): string[] {
    return this.registry.list().map((g) => g.id);
  }
}
