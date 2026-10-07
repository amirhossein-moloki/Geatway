import {
  PaymentPlatformError,
  ValidationError,
  GatewayNotFoundError,
  GatewayDisabledError,
  UnsupportedCapabilityError,
  InvalidPaymentStateError,
  GatewayError,
} from '@amirhossein-moloki/payment-core';
import { createPaymentApplication } from './payment.js';

export class AppController {
  private readonly app = createPaymentApplication();

  public async handleCreatePayment(body: {
    gateway: string;
    amount: number;
    currency: string;
    description?: string;
    idempotencyKey?: string;
  }) {
    try {
      const result = await this.app.service.createPayment({
        gateway: body.gateway,
        amount: body.amount,
        currency: body.currency,
        description: body.description,
        idempotencyKey: body.idempotencyKey,
      });

      return {
        statusCode: 201,
        body: {
          paymentId: result.payment.id,
          status: result.status,
          redirectUrl: result.redirectUrl,
          actionUrl: result.actionUrl,
          action: result.action,
          gatewayTransactionId: result.gatewayTransactionId,
        },
      };
    } catch (err) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleGetPayment(id: string) {
    try {
      const payment = await this.app.service.getPayment(id);
      return {
        statusCode: 200,
        body: payment,
      };
    } catch (err) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleCallback(
    gateway: string,
    req: {
      query: Record<string, unknown>;
      body: Record<string, unknown>;
      headers: Record<string, string | string[] | undefined>;
    },
  ) {
    try {
      const callbackResult = await this.app.service.handleCallback(gateway, req);

      if (callbackResult.isSuccess && callbackResult.paymentId) {
        // Automatically trigger payment verification
        const verifyResult = await this.app.service.verifyPayment({
          paymentId: callbackResult.paymentId,
          gatewayTransactionId: callbackResult.gatewayTransactionId,
          reference: callbackResult.reference,
          callbackData: callbackResult.rawData,
        });

        if (verifyResult.status === 'SUCCESS') {
          return {
            statusCode: 302,
            redirectUrl: `/payment/success?id=${callbackResult.paymentId}`,
          };
        }
      }

      return {
        statusCode: 302,
        redirectUrl: `/payment/failed?id=${callbackResult.paymentId || 'unknown'}`,
      };
    } catch (err) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleVerifyPayment(
    id: string,
    body?: { gatewayTransactionId?: string; reference?: string },
  ) {
    try {
      const result = await this.app.service.verifyPayment({
        paymentId: id,
        gatewayTransactionId: body?.gatewayTransactionId,
        reference: body?.reference,
      });

      return {
        statusCode: 200,
        body: {
          paymentId: result.payment.id,
          status: result.status,
          reference: result.reference,
          gatewayTransactionId: result.gatewayTransactionId,
        },
      };
    } catch (err) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleInquirePayment(id: string) {
    try {
      const result = await this.app.service.inquirePayment(id);
      return {
        statusCode: 200,
        body: {
          paymentId: result.payment.id,
          status: result.status,
          amount: result.amount,
          reference: result.reference,
        },
      };
    } catch (err) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleRefundPayment(id: string, body?: { amount?: number; reason?: string }) {
    try {
      const result = await this.app.service.refundPayment({
        paymentId: id,
        amount: body?.amount,
        reason: body?.reason,
      });

      return {
        statusCode: 200,
        body: {
          paymentId: result.payment.id,
          status: result.status,
          amountRefunded: result.amountRefunded,
          refundTransactionId: result.refundTransactionId,
        },
      };
    } catch (err) {
      return this.mapErrorToResponse(err);
    }
  }

  private mapErrorToResponse(err: unknown) {
    if (err instanceof ValidationError) {
      return { statusCode: 400, body: { error: 'ValidationError', message: err.message } };
    }
    if (err instanceof GatewayNotFoundError || err instanceof GatewayDisabledError) {
      return { statusCode: 404, body: { error: 'GatewayNotFound', message: err.message } };
    }
    if (err instanceof UnsupportedCapabilityError) {
      return { statusCode: 400, body: { error: 'UnsupportedCapability', message: err.message } };
    }
    if (err instanceof InvalidPaymentStateError) {
      return { statusCode: 409, body: { error: 'InvalidPaymentState', message: err.message } };
    }
    if (err instanceof GatewayError) {
      return {
        statusCode: 502,
        body: { error: 'GatewayError', code: err.code, message: err.message },
      };
    }
    if (err instanceof PaymentPlatformError) {
      return { statusCode: 500, body: { error: 'PaymentError', message: err.message } };
    }

    const message = err instanceof Error ? err.message : String(err);
    return { statusCode: 500, body: { error: 'InternalError', message } };
  }
}
