import { describe, it, expect, beforeEach } from 'vitest';
import {
  Payment,
  Transaction,
  TransactionType,
  TransactionStatus,
  RepositoryNotFoundError,
} from '@company/payment-core';
import { PostgresPaymentRepository } from '../src/repositories/postgres-payment-repository.js';
import { PostgresTransactionRepository } from '../src/repositories/postgres-transaction-repository.js';
import { createTestDatabase } from './test-utils.js';
import { PgExecutor } from '../src/migrator.js';

describe('PostgresTransactionRepository', () => {
  let db: PgExecutor;
  let paymentRepo: PostgresPaymentRepository;
  let txRepo: PostgresTransactionRepository;
  let payment: Payment;

  beforeEach(async () => {
    db = await createTestDatabase();
    paymentRepo = new PostgresPaymentRepository(db);
    txRepo = new PostgresTransactionRepository(db);

    payment = new Payment({
      amount: 15000,
      currency: 'IRR',
      gateway: 'mellat',
    });
    await paymentRepo.create(payment);
  });

  it('should create and retrieve a transaction by ID', async () => {
    const tx = new Transaction({
      paymentId: payment.id,
      gateway: 'mellat',
      type: TransactionType.PAYMENT,
      status: TransactionStatus.SUCCESS,
      amount: 15000,
      reference: 'REF_98765',
      gatewayTransactionId: 'GW_TX_123',
    });

    const created = await txRepo.create(tx);
    expect(created.id).toBe(tx.id);
    expect(created.paymentId).toBe(payment.id);
    expect(created.reference).toBe('REF_98765');
    expect(created.gatewayTransactionId).toBe('GW_TX_123');

    const found = await txRepo.findById(tx.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(tx.id);
  });

  it('should support multiple transactions for a single payment (1:N relationship)', async () => {
    const tx1 = new Transaction({
      paymentId: payment.id,
      gateway: 'mellat',
      type: TransactionType.PAYMENT,
      status: TransactionStatus.SUCCESS,
      amount: 15000,
      reference: 'REF_INITIAL',
    });
    const tx2 = new Transaction({
      paymentId: payment.id,
      gateway: 'mellat',
      type: TransactionType.VERIFY,
      status: TransactionStatus.SUCCESS,
      amount: 15000,
      reference: 'REF_VERIFY',
    });

    await txRepo.create(tx1);
    await txRepo.create(tx2);

    const paymentTxList = await txRepo.findByPaymentId(payment.id);
    expect(paymentTxList.length).toBe(2);
    expect(paymentTxList[0].type).toBe(TransactionType.PAYMENT);
    expect(paymentTxList[1].type).toBe(TransactionType.VERIFY);
  });

  it('should find transaction by provider reference or gateway transaction id', async () => {
    const tx = new Transaction({
      paymentId: payment.id,
      gateway: 'saman',
      type: TransactionType.PAYMENT,
      status: TransactionStatus.SUCCESS,
      amount: 5000,
      reference: 'SAMAN_REF_444',
      gatewayTransactionId: 'SAMAN_GW_555',
    });
    await txRepo.create(tx);

    const foundByRef = await txRepo.findByProviderReference('saman', 'SAMAN_REF_444');
    expect(foundByRef?.id).toBe(tx.id);

    const foundByGwId = await txRepo.findByProviderReference('saman', 'SAMAN_GW_555');
    expect(foundByGwId?.id).toBe(tx.id);
  });

  it('should find transactions by type for a payment', async () => {
    const txPayment = new Transaction({
      paymentId: payment.id,
      gateway: 'zibal',
      type: TransactionType.PAYMENT,
      status: TransactionStatus.SUCCESS,
      amount: 10000,
    });
    const txRefund = new Transaction({
      paymentId: payment.id,
      gateway: 'zibal',
      type: TransactionType.REFUND,
      status: TransactionStatus.SUCCESS,
      amount: 5000,
    });

    await txRepo.create(txPayment);
    await txRepo.create(txRefund);

    const refunds = await txRepo.findByType(payment.id, TransactionType.REFUND);
    expect(refunds.length).toBe(1);
    expect(refunds[0].id).toBe(txRefund.id);
    expect(refunds[0].amount).toBe(5000);
  });

  it('should update transaction status and throw error if not found', async () => {
    const tx = new Transaction({
      paymentId: payment.id,
      gateway: 'mellat',
      type: TransactionType.PAYMENT,
      status: TransactionStatus.PENDING,
      amount: 15000,
    });
    await txRepo.create(tx);

    const updatedTx = new Transaction({
      id: tx.id,
      paymentId: tx.paymentId,
      gateway: tx.gateway,
      type: tx.type,
      status: TransactionStatus.FAILED,
      amount: tx.amount,
    });

    const result = await txRepo.update(updatedTx);
    expect(result.status).toBe(TransactionStatus.FAILED);

    const nonExistent = new Transaction({
      id: 'tx_does_not_exist',
      paymentId: payment.id,
      gateway: 'mellat',
      type: TransactionType.PAYMENT,
      status: TransactionStatus.FAILED,
      amount: 1000,
    });
    await expect(txRepo.update(nonExistent)).rejects.toThrow(RepositoryNotFoundError);
  });
});
