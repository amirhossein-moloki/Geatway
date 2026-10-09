import { GatewayRegistry } from '@amirhossein-moloki/payment-core';
import { PaymentApplicationService } from '@amirhossein-moloki/payment-service';
import {
  InMemoryPaymentRepository,
  InMemoryTransactionRepository,
  InMemoryIdempotencyRepository,
  InMemoryWebhookEventRepository,
} from '@amirhossein-moloki/payment-service/testing';
import {
  WalletService,
  MedusaWalletModuleService,
  MedusaWalletPaymentProvider,
} from '@amirhossein-moloki/wallet-core';
import { loadConfig, AppConfig } from './config.js';
import { createGatewayRegistry } from './gateway-factory.js';
import { InMemoryWalletRepository, InMemoryLedgerRepository } from './in-memory-wallet-repo.js';

export class DepixPaymentApp {
  public readonly config: AppConfig;
  public readonly registry: GatewayRegistry;
  public readonly paymentRepository: InMemoryPaymentRepository;
  public readonly transactionRepository: InMemoryTransactionRepository;
  public readonly idempotencyRepository: InMemoryIdempotencyRepository;
  public readonly webhookEventRepository: InMemoryWebhookEventRepository;
  public readonly service: PaymentApplicationService;

  // Wallet Domain Services
  public readonly walletRepository: InMemoryWalletRepository;
  public readonly ledgerRepository: InMemoryLedgerRepository;
  public readonly walletService: WalletService;
  public readonly walletModuleService: MedusaWalletModuleService;
  public readonly walletPaymentProvider: MedusaWalletPaymentProvider;

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

    // Initialize Wallet Domain Services & Medusa Adapters
    this.walletRepository = new InMemoryWalletRepository();
    this.ledgerRepository = new InMemoryLedgerRepository();
    this.walletService = new WalletService({
      walletRepository: this.walletRepository,
      ledgerRepository: this.ledgerRepository,
    });
    this.walletModuleService = new MedusaWalletModuleService({
      walletService: this.walletService,
    });
    this.walletPaymentProvider = new MedusaWalletPaymentProvider(this.walletService);
  }

  public getRegisteredGateways(): string[] {
    return this.registry.list().map((g) => g.id);
  }
}
