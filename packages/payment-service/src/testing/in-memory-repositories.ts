import {
  Payment,
  PaymentFilter,
  PaymentRepository,
  Transaction,
  TransactionType,
  TransactionRepository,
  IdempotencyRecord,
  IdempotencyRepository,
  WebhookEvent,
  WebhookEventRepository,
  RepositoryNotFoundError,
  ConcurrencyError,
} from '@amirhossein-moloki/payment-core';

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly payments = new Map<string, Payment>();

  public async create(payment: Payment): Promise<Payment> {
    this.payments.set(payment.id, payment);
    return payment;
  }

  public async findById(id: string): Promise<Payment | null> {
    const payment = this.payments.get(id);
    return payment || null;
  }

  public async findByExternalId(externalId: string): Promise<Payment | null> {
    for (const payment of this.payments.values()) {
      if (
        payment.metadata?.externalId === externalId ||
        payment.metadata?.gatewayTransactionId === externalId
      ) {
        return payment;
      }
    }
    return null;
  }

  public async update(payment: Payment, expectedVersion?: number): Promise<Payment> {
    const existing = this.payments.get(payment.id);
    if (!existing) {
      throw new RepositoryNotFoundError('Payment', payment.id);
    }

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Optimistic locking error for payment ${payment.id}: expected version ${expectedVersion}, got ${existing.version}`,
      );
    }

    const updatedPayment = new Payment({
      id: payment.id,
      projectId: payment.projectId,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      callbackUrl: payment.callbackUrl,
      gateway: payment.gateway,
      status: payment.status,
      metadata: payment.metadata,
      idempotencyKey: payment.idempotencyKey,
      version: existing.version + 1,
      createdAt: payment.createdAt,
      updatedAt: new Date(),
    });

    this.payments.set(payment.id, updatedPayment);
    return updatedPayment;
  }

  public async list(filter?: PaymentFilter): Promise<Payment[]> {
    let list = Array.from(this.payments.values());

    if (filter?.status) {
      list = list.filter((p) => p.status === filter.status);
    }
    if (filter?.gateway) {
      list = list.filter((p) => p.gateway === filter.gateway);
    }
    if (filter?.projectId) {
      list = list.filter((p) => p.projectId === filter.projectId);
    }

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? list.length;

    return list.slice(offset, offset + limit);
  }

  public clear(): void {
    this.payments.clear();
  }
}

export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly transactions = new Map<string, Transaction>();

  public async create(transaction: Transaction): Promise<Transaction> {
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  public async findById(id: string): Promise<Transaction | null> {
    return this.transactions.get(id) || null;
  }

  public async findByPaymentId(paymentId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter((t) => t.paymentId === paymentId);
  }

  public async findByProviderReference(
    gateway: string,
    reference: string,
  ): Promise<Transaction | null> {
    for (const tx of this.transactions.values()) {
      if (
        tx.gateway === gateway &&
        (tx.reference === reference || tx.gatewayTransactionId === reference)
      ) {
        return tx;
      }
    }
    return null;
  }

  public async findByType(paymentId: string, type: TransactionType): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(
      (t) => t.paymentId === paymentId && t.type === type,
    );
  }

  public async update(transaction: Transaction): Promise<Transaction> {
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  public clear(): void {
    this.transactions.clear();
  }
}

export class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly records = new Map<string, IdempotencyRecord>();

  private makeKey(scope: string, key: string): string {
    return `${scope}:${key}`;
  }

  public async save(record: IdempotencyRecord): Promise<IdempotencyRecord> {
    this.records.set(this.makeKey(record.scope, record.key), record);
    return record;
  }

  public async findByScopeAndKey(scope: string, key: string): Promise<IdempotencyRecord | null> {
    return this.records.get(this.makeKey(scope, key)) || null;
  }

  public async update(record: IdempotencyRecord): Promise<IdempotencyRecord> {
    this.records.set(this.makeKey(record.scope, record.key), record);
    return record;
  }

  public async delete(scope: string, key: string): Promise<boolean> {
    return this.records.delete(this.makeKey(scope, key));
  }

  public clear(): void {
    this.records.clear();
  }
}

export class InMemoryWebhookEventRepository implements WebhookEventRepository {
  private readonly events = new Map<string, WebhookEvent>();

  public async create(event: WebhookEvent): Promise<WebhookEvent> {
    this.events.set(event.id, event);
    return event;
  }

  public async findById(id: string): Promise<WebhookEvent | null> {
    return this.events.get(id) || null;
  }

  public async findByProviderAndEventId(
    provider: string,
    eventId: string,
  ): Promise<WebhookEvent | null> {
    for (const event of this.events.values()) {
      if (event.provider === provider && event.eventId === eventId) {
        return event;
      }
    }
    return null;
  }

  public async update(event: WebhookEvent): Promise<WebhookEvent> {
    this.events.set(event.id, event);
    return event;
  }

  public async listPendingOrFailed(maxAttempts = 5, limit = 50): Promise<WebhookEvent[]> {
    const list = Array.from(this.events.values()).filter(
      (e) => (e.status === 'RECEIVED' || e.status === 'FAILED') && e.attempts < maxAttempts,
    );
    return list.slice(0, limit);
  }

  public clear(): void {
    this.events.clear();
  }
}
