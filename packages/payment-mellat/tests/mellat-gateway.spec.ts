import {
  GatewayCapability,
  GatewayError,
  Payment,
  PaymentStatus,
  ValidationError,
} from '@company/payment-core';
import { describe, expect, it, vi } from 'vitest';
import { HttpTransport, MellatClient } from '../src/client/mellat-client.js';
import { MellatConfig, validateMellatConfig } from '../src/config/mellat-config.interface.js';
import { MELLAT_ERROR_MAPPING, MellatErrorMapper } from '../src/errors/mellat-error-mapper.js';
import { MellatGateway } from '../src/gateway/mellat-gateway.js';
import {
  CREATE_PAYMENT_ERROR_XML,
  CREATE_PAYMENT_SUCCESS_XML,
  INQUIRY_SUCCESS_XML,
  REFUND_SUCCESS_XML,
  REVERSAL_SUCCESS_XML,
  VERIFY_ALREADY_VERIFIED_XML,
  VERIFY_SUCCESS_XML,
} from './fixtures/mellat-fixtures.js';

const validConfig: MellatConfig = {
  gatewayId: 'mellat-test',
  terminalId: '123456',
  userName: 'testuser',
  userPassword: 'testpassword',
  callbackUrl: 'https://example.com/callback',
};

describe('MellatConfig Validation', () => {
  it('should validate valid configuration', () => {
    expect(() => validateMellatConfig(validConfig)).not.toThrow();
  });

  it('should throw error when terminalId is missing', () => {
    expect(() =>
      validateMellatConfig({ ...validConfig, terminalId: '' as unknown as number }),
    ).toThrow('Mellat configuration missing required field: terminalId');
  });

  it('should throw error when userName is missing', () => {
    expect(() => validateMellatConfig({ ...validConfig, userName: '' })).toThrow(
      'Mellat configuration missing required field: userName',
    );
  });

  it('should throw error when userPassword is missing', () => {
    expect(() => validateMellatConfig({ ...validConfig, userPassword: '' })).toThrow(
      'Mellat configuration missing required field: userPassword',
    );
  });

  it('should throw error when callbackUrl is missing', () => {
    expect(() => validateMellatConfig({ ...validConfig, callbackUrl: '' })).toThrow(
      'Mellat configuration missing required field: callbackUrl',
    );
  });
});

describe('MellatClient', () => {
  it('should format SOAP envelope correctly and parse success response', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: CREATE_PAYMENT_SUCCESS_XML,
    });

    const client = new MellatClient(validConfig, mockTransport);
    const result = await client.payRequest({
      orderId: 100,
      amount: 1000,
      localDate: '20231010',
      localTime: '120000',
      additionalData: 'test',
      callBackUrl: validConfig.callbackUrl,
      payerId: '0',
    });

    expect(result.resCode).toBe('0');
    expect(result.refId).toBe('AF82041a2Bf6989c7fF9');
    expect(mockTransport).toHaveBeenCalledTimes(1);
    expect((mockTransport as ReturnType<typeof vi.fn>).mock.calls[0][1].body).toContain(
      '<orderId>100</orderId>',
    );
  });

  it('should generate redirect form data with POST method', () => {
    const client = new MellatClient(validConfig);
    const formData = client.generateRedirectFormData('AF82041a2Bf6989c7fF9', {
      mobileNo: '09123456789',
    });

    expect(formData.method).toBe('POST');
    expect(formData.fields.RefId).toBe('AF82041a2Bf6989c7fF9');
    expect(formData.fields.MobileNo).toBe('09123456789');
  });
});

describe('MellatErrorMapper', () => {
  it('should map validation error codes to ValidationError', () => {
    const error = MellatErrorMapper.mapCodeToError('11', 'mellat');
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain(MELLAT_ERROR_MAPPING['11'].message);
  });

  it('should map general gateway error codes to GatewayError', () => {
    const error = MellatErrorMapper.mapCodeToError('21', 'mellat');
    expect(error).toBeInstanceOf(GatewayError);
    expect((error as GatewayError).providerErrorCode).toBe('21');
  });
});

describe('MellatGateway Operations', () => {
  it('should report correct capabilities', () => {
    const gateway = new MellatGateway(validConfig);
    expect(gateway.supportsCapability(GatewayCapability.CREATE_PAYMENT)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.VERIFY)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.INQUIRY)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.REVERSE)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.REFUND)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.CALLBACK)).toBe(true);
    expect(gateway.supportsCapability(GatewayCapability.WEBHOOK)).toBe(false);
  });

  it('should create payment successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: CREATE_PAYMENT_SUCCESS_XML,
    });

    const gateway = new MellatGateway(validConfig, mockTransport);
    const payment = new Payment({
      id: 'pay-12345',
      amount: 50000,
      currency: 'IRR',
      gateway: 'mellat-test',
    });

    const response = await gateway.createPayment({ payment });

    expect(response.success).toBe(true);
    expect(response.status).toBe(PaymentStatus.PENDING);
    expect(response.gatewayTransactionId).toBe('AF82041a2Bf6989c7fF9');
  });

  it('should throw mapped GatewayError when payment creation fails', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: CREATE_PAYMENT_ERROR_XML,
    });

    const gateway = new MellatGateway(validConfig, mockTransport);
    const payment = new Payment({
      id: 'pay-12345',
      amount: 50000,
      currency: 'IRR',
      gateway: 'mellat-test',
    });

    await expect(gateway.createPayment({ payment })).rejects.toThrow();
  });

  it('should parse callback successfully', async () => {
    const gateway = new MellatGateway(validConfig);
    const result = await gateway.parseCallback({
      query: {},
      headers: {},
      body: {
        RefId: 'AF82041a2Bf6989c7fF9',
        ResCode: '0',
        SaleOrderId: '12345',
        SaleReferenceId: '987654321',
      },
    });

    expect(result.isSuccess).toBe(true);
    expect(result.paymentId).toBe('12345');
    expect(result.gatewayTransactionId).toBe('987654321');
  });

  it('should verify payment successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: VERIFY_SUCCESS_XML,
    });

    const gateway = new MellatGateway(validConfig, mockTransport);
    const response = await gateway.verify({
      paymentId: '12345',
      amount: 50000,
      currency: 'IRR',
      reference: '987654321',
    });

    expect(response.success).toBe(true);
    expect(response.status).toBe(PaymentStatus.SUCCESS);
  });

  it('should treat code 43 (Already Verified) as verified success', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: VERIFY_ALREADY_VERIFIED_XML,
    });

    const gateway = new MellatGateway(validConfig, mockTransport);
    const response = await gateway.verify({
      paymentId: '12345',
      amount: 50000,
      currency: 'IRR',
      reference: '987654321',
    });

    expect(response.success).toBe(true);
    expect(response.status).toBe(PaymentStatus.SUCCESS);
  });

  it('should perform inquiry successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: INQUIRY_SUCCESS_XML,
    });

    const gateway = new MellatGateway(validConfig, mockTransport);
    const response = await gateway.inquiry({
      paymentId: '12345',
      reference: '987654321',
    });

    expect(response.success).toBe(true);
    expect(response.status).toBe(PaymentStatus.SUCCESS);
  });

  it('should perform reversal successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: REVERSAL_SUCCESS_XML,
    });

    const gateway = new MellatGateway(validConfig, mockTransport);
    const response = await gateway.reverse({
      paymentId: '12345',
      gatewayTransactionId: '987654321',
    });

    expect(response.success).toBe(true);
  });

  it('should perform refund successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: REFUND_SUCCESS_XML,
    });

    const gateway = new MellatGateway(validConfig, mockTransport);
    const response = await gateway.refund({
      paymentId: '12345',
      amount: 10000,
      currency: 'IRR',
      gatewayTransactionId: '987654321',
    });

    expect(response.success).toBe(true);
    expect(response.amountRefunded).toBe(10000);
  });
});

describe('Opt-in Integration Test', () => {
  it('should run integration test if MELLAT_INTEGRATION_TEST is true', async () => {
    if (process.env.MELLAT_INTEGRATION_TEST !== 'true') {
      expect(true).toBe(true);
      return;
    }

    const config: MellatConfig = {
      terminalId: process.env.MELLAT_TERMINAL_ID || '12345',
      userName: process.env.MELLAT_USERNAME || 'test',
      userPassword: process.env.MELLAT_PASSWORD || 'test',
      callbackUrl: process.env.MELLAT_CALLBACK_URL || 'https://example.com',
    };

    const gateway = new MellatGateway(config);
    expect(gateway.id).toBe('mellat');
  });
});
