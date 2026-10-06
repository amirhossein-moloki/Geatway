import { Transaction, TransactionType } from '../domain/transaction/transaction.entity.js';

export interface TransactionRepository {
  create(transaction: Transaction): Promise<Transaction>;
  findById(id: string): Promise<Transaction | null>;
  findByPaymentId(paymentId: string): Promise<Transaction[]>;
  findByProviderReference(gateway: string, reference: string): Promise<Transaction | null>;
  findByType(paymentId: string, type: TransactionType): Promise<Transaction[]>;
  update(transaction: Transaction): Promise<Transaction>;
}
