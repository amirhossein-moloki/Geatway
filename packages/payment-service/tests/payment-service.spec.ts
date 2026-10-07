import { describe, it, expect, beforeEach } from 'vitest';
import {
  PaymentStatus,
  TransactionType,
  TransactionStatus,
  ValidationError,
  GatewayNotFoundError,
  InvalidPaymentStateError,
} from '@amirhossein-moloki/payment-core';
import { createTestPaymentService, TestEnvironment } from '../src/testing/index.js';

describe('PaymentApplicationService Integration & Workflows', () => {
  let env: TestEnvironment;

  beforeEach(() => {
    env = createTestPaymentService();
  });

  describe('createPayment', () => {
    it('should create payment, persist entity and transaction, and return typed output', async () => {
      const result = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 50000,
        currency: 'IRR',
        callbackUrl: 'https://example.com/callback',
        description: 'Test Order Payment',
        projectId: 'proj_123',
        metadata: { orderId: 'ord_999' },
      });

      expect(result.payment).toBeDefined();
      expect(result.payment.amount).toBe(50000);
      expect(result.payment.currency).toBe('IRR');
      expect(result.payment.status).toBe(PaymentStatus.PENDING);
      expect(result.redirectUrl).toBe(`https://test-gateway.com/pay/${result.payment.id}`);
      expect(result.transaction).toBeDefined();
      expect(result.transaction.type).toBe(TransactionType.PAYMENT);
      expect(result.transaction.status).toBe(TransactionStatus.SUCCESS);

      const savedPayment = await env.paymentRepo.findById(result.payment.id);
      expect(savedPayment).not.toBeNull();
      expect(savedPayment?.status).toBe(PaymentStatus.PENDING);

      const savedTxs = await env.transactionRepo.findByPaymentId(result.payment.id);
      expect(savedTxs).toHaveLength(1);
    });

    it('should throw ValidationError if gateway or amount is invalid', async () => {
      await expect(
        env.service.createPayment({
          gateway: '',
          amount: 50000,
          currency: 'IRR',
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        env.service.createPayment({
          gateway: 'test-gateway',
          amount: 0,
          currency: 'IRR',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw GatewayNotFoundError if gateway is not registered', async () => {
      await expect(
        env.service.createPayment({
          gateway: 'unregistered-gateway',
          amount: 1000,
          currency: 'IRR',
        }),
      ).rejects.toThrow(GatewayNotFoundError);
    });
  });

  describe('getPayment & inquirePayment', () => {
    it('should retrieve existing payment by ID', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 10000,
        currency: 'IRR',
      });

      const retrieved = await env.service.getPayment(created.payment.id);
      expect(retrieved.id).toBe(created.payment.id);
      expect(retrieved.amount).toBe(10000);
    });

    it('should inquire remote provider state and record INQUIRY transaction', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 20000,
        currency: 'IRR',
      });

      const inqResult = await env.service.inquirePayment(created.payment.id);
      expect(inqResult.payment.id).toBe(created.payment.id);
      expect(inqResult.transaction.type).toBe(TransactionType.INQUIRY);
      expect(inqResult.transaction.status).toBe(TransactionStatus.SUCCESS);
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment and transition state to SUCCESS', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 15000,
        currency: 'IRR',
      });

      const verifyResult = await env.service.verifyPayment({
        paymentId: created.payment.id,
        gatewayTransactionId: created.gatewayTransactionId,
      });

      expect(verifyResult.status).toBe(PaymentStatus.SUCCESS);
      expect(verifyResult.payment.status).toBe(PaymentStatus.SUCCESS);
      expect(verifyResult.transaction.type).toBe(TransactionType.VERIFY);
      expect(verifyResult.cardMask).toBe('603799******1234');
    });

    it('should short-circuit safely if payment is already in SUCCESS state without calling gateway again', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 15000,
        currency: 'IRR',
      });

      await env.service.verifyPayment({
        paymentId: created.payment.id,
      });

      const gatewayCallsBefore = env.gateway.callCount['verify'] || 0;

      const secondResult = await env.service.verifyPayment({
        paymentId: created.payment.id,
      });

      expect(secondResult.status).toBe(PaymentStatus.SUCCESS);
      expect(env.gateway.callCount['verify']).toBe(gatewayCallsBefore);
    });
  });

  describe('authorizePayment & capturePayment', () => {
    it('should authorize and capture payment in two-step flow', async () => {
      const authResult = await env.service.authorizePayment({
        gateway: 'test-gateway',
        amount: 30000,
        currency: 'USD',
      });

      expect(authResult.status).toBe(PaymentStatus.AUTHORIZED);
      expect(authResult.transaction.type).toBe(TransactionType.AUTHORIZATION);

      const capResult = await env.service.capturePayment({
        paymentId: authResult.payment.id,
        amount: 30000,
      });

      expect(capResult.status).toBe(PaymentStatus.SUCCESS);
      expect(capResult.transaction.type).toBe(TransactionType.CAPTURE);
      expect(capResult.amountCaptured).toBe(30000);
    });

    it('should reject capture if payment is not in AUTHORIZED state', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 10000,
        currency: 'IRR',
      });

      await expect(
        env.service.capturePayment({
          paymentId: created.payment.id,
        }),
      ).rejects.toThrow(InvalidPaymentStateError);
    });
  });

  describe('refundPayment', () => {
    it('should perform full refund on SUCCESS payment', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 40000,
        currency: 'IRR',
      });
      await env.service.verifyPayment({ paymentId: created.payment.id });

      const refundResult = await env.service.refundPayment({
        paymentId: created.payment.id,
        amount: 40000,
        reason: 'Customer requested refund',
      });

      expect(refundResult.status).toBe(PaymentStatus.REFUNDED);
      expect(refundResult.amountRefunded).toBe(40000);
      expect(refundResult.transaction.type).toBe(TransactionType.REFUND);
    });

    it('should perform partial refund and transition to PARTIALLY_REFUNDED', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 50000,
        currency: 'IRR',
      });
      await env.service.verifyPayment({ paymentId: created.payment.id });

      const refund1 = await env.service.refundPayment({
        paymentId: created.payment.id,
        amount: 20000,
      });

      expect(refund1.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
      expect(refund1.amountRefunded).toBe(20000);

      const refund2 = await env.service.refundPayment({
        paymentId: created.payment.id,
        amount: 30000,
      });

      expect(refund2.status).toBe(PaymentStatus.REFUNDED);
      expect(refund2.amountRefunded).toBe(30000);
    });

    it('should throw ValidationError if refund amount exceeds remaining refundable amount', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 50000,
        currency: 'IRR',
      });
      await env.service.verifyPayment({ paymentId: created.payment.id });

      await env.service.refundPayment({
        paymentId: created.payment.id,
        amount: 30000,
      });

      await expect(
        env.service.refundPayment({
          paymentId: created.payment.id,
          amount: 30000,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('cancelPayment & reversePayment', () => {
    it('should cancel payment and transition status to CANCELLED', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 10000,
        currency: 'IRR',
      });

      const cancelResult = await env.service.cancelPayment({
        paymentId: created.payment.id,
        reason: 'User cancelled transaction',
      });

      expect(cancelResult.status).toBe(PaymentStatus.CANCELLED);
      expect(cancelResult.transaction.type).toBe(TransactionType.CANCEL);
    });

    it('should reverse payment and transition status to REVERSED', async () => {
      const authorized = await env.service.authorizePayment({
        gateway: 'test-gateway',
        amount: 10000,
        currency: 'USD',
      });

      const revResult = await env.service.reversePayment({
        paymentId: authorized.payment.id,
        reason: 'System reversal',
      });

      expect(revResult.status).toBe(PaymentStatus.REVERSED);
      expect(revResult.transaction.type).toBe(TransactionType.REVERSE);
    });
  });

  describe('handleCallback', () => {
    it('should parse callback and update payment to CALLBACK_RECEIVED', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 10000,
        currency: 'IRR',
      });

      const callbackResult = await env.service.handleCallback('test-gateway', {
        query: { paymentId: created.payment.id, status: 'OK', gtx: 'gtx_123' },
        body: {},
        headers: {},
      });

      expect(callbackResult.isSuccess).toBe(true);
      expect(callbackResult.payment?.id).toBe(created.payment.id);
      expect(callbackResult.payment?.status).toBe(PaymentStatus.CALLBACK_RECEIVED);
    });
  });

  describe('handleWebhook', () => {
    it('should process webhook event, persist record, and apply payment state change', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 25000,
        currency: 'IRR',
      });

      const webhookResult = await env.service.handleWebhook('test-gateway', {
        query: {},
        body: {
          event: 'payment.success',
          paymentId: created.payment.id,
          status: PaymentStatus.SUCCESS,
        },
        headers: { 'x-event-id': 'evt_001' },
      });

      expect(webhookResult.isDuplicate).toBe(false);
      expect(webhookResult.webhookEvent.eventId).toBe('evt_001');
      expect(webhookResult.payment?.status).toBe(PaymentStatus.SUCCESS);
    });

    it('should deduplicate repeated webhook events safely', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 25000,
        currency: 'IRR',
      });

      const request = {
        query: {},
        body: {
          event: 'payment.success',
          paymentId: created.payment.id,
          status: PaymentStatus.SUCCESS,
        },
        headers: { 'x-event-id': 'evt_repeat_001' },
      };

      const result1 = await env.service.handleWebhook('test-gateway', request);
      expect(result1.isDuplicate).toBe(false);

      const result2 = await env.service.handleWebhook('test-gateway', request);
      expect(result2.isDuplicate).toBe(true);
    });

    it('should ignore out-of-order webhook events that attempt to regress terminal payment state', async () => {
      const created = await env.service.createPayment({
        gateway: 'test-gateway',
        amount: 25000,
        currency: 'IRR',
      });

      await env.service.verifyPayment({ paymentId: created.payment.id });
      const verifiedPayment = await env.service.getPayment(created.payment.id);
      expect(verifiedPayment.status).toBe(PaymentStatus.SUCCESS);

      const staleWebhook = await env.service.handleWebhook('test-gateway', {
        query: {},
        body: {
          event: 'payment.pending',
          paymentId: created.payment.id,
          status: PaymentStatus.PENDING,
        },
        headers: { 'x-event-id': 'evt_stale_1' },
      });

      expect(staleWebhook.payment?.status).toBe(PaymentStatus.SUCCESS);
    });
  });
});
