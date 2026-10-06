import { describe, it, expect, beforeEach } from 'vitest';
import { GatewayError, PaymentStatus } from '@company/payment-core';
import { createTestPaymentService, TestEnvironment } from '../src/testing/index.js';

describe('MockGateway Failure & Flow Scenarios', () => {
  let env: TestEnvironment;

  beforeEach(() => {
    env = createTestPaymentService();
  });

  it('should handle success scenario by default', async () => {
    const created = await env.service.createPayment({
      gateway: 'test-gateway',
      amount: 10000,
      currency: 'IRR',
    });
    expect(created.payment.status).toBe(PaymentStatus.PENDING);

    const verified = await env.service.verifyPayment({
      paymentId: created.payment.id,
    });
    expect(verified.status).toBe(PaymentStatus.SUCCESS);
  });

  it('should simulate card declined scenario', async () => {
    env.gateway.scenario = 'declined';

    await expect(
      env.service.createPayment({
        gateway: 'test-gateway',
        amount: 10000,
        currency: 'IRR',
      }),
    ).rejects.toThrow(GatewayError);
  });

  it('should simulate request timeout scenario', async () => {
    env.gateway.scenario = 'timeout';

    await expect(
      env.service.createPayment({
        gateway: 'test-gateway',
        amount: 10000,
        currency: 'IRR',
      }),
    ).rejects.toThrow(/timed out/i);
  });

  it('should simulate network error scenario', async () => {
    env.gateway.scenario = 'network-error';

    await expect(
      env.service.createPayment({
        gateway: 'test-gateway',
        amount: 10000,
        currency: 'IRR',
      }),
    ).rejects.toThrow(/Network connection failed/i);
  });

  it('should simulate provider internal error scenario', async () => {
    env.gateway.scenario = 'provider-error';

    await expect(
      env.service.createPayment({
        gateway: 'test-gateway',
        amount: 10000,
        currency: 'IRR',
      }),
    ).rejects.toThrow(/Internal provider error/i);
  });

  it('should simulate redirect URL on payment creation', async () => {
    env.gateway.scenario = 'customer-action-required';

    const result = await env.service.createPayment({
      gateway: 'test-gateway',
      amount: 10000,
      currency: 'IRR',
    });

    expect(result.payment.status).toBe(PaymentStatus.PENDING);
    expect(result.redirectUrl).toContain('/action/');
  });

  it('should simulate failed status scenario on verify', async () => {
    env.gateway.scenario = 'pending';

    const created = await env.service.createPayment({
      gateway: 'test-gateway',
      amount: 10000,
      currency: 'IRR',
    });

    const verified = await env.service.verifyPayment({
      paymentId: created.payment.id,
    });

    expect(verified.status).toBe(PaymentStatus.FAILED);
  });
});
