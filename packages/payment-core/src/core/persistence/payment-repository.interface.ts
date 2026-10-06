import { Payment } from '../domain/payment/payment.entity.js';
import { PaymentStatus } from '../domain/payment/payment-status.enum.js';

export interface PaymentFilter {
  status?: PaymentStatus;
  gateway?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface PaymentRepository {
  create(payment: Payment): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findByExternalId(externalId: string): Promise<Payment | null>;
  update(payment: Payment, expectedVersion?: number): Promise<Payment>;
  list(filter?: PaymentFilter): Promise<Payment[]>;
}
