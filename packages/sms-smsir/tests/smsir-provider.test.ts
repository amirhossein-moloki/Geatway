import { describe, expect, it, vi } from 'vitest';
import {
  SmsCapability,
  SmsMessage,
  SmsStatus,
  SmsValidationError,
} from '@amirhossein-moloki/sms-core';
import { SmsirProvider } from '../src/provider/smsir-provider.js';
import { HttpTransport } from '../src/client/smsir-client.js';

describe('SmsirProvider Unit Tests', () => {
  const validConfig = {
    apiKey: 'test_x_api_key_123',
    lineNumber: '300000000000',
  };

  it('throws validation error if apiKey is missing', () => {
    expect(() => new SmsirProvider({ apiKey: '' })).toThrow(SmsValidationError);
  });

  it('correctly initializes capabilities and metadata', () => {
    const provider = new SmsirProvider(validConfig);
    expect(provider.id).toBe('smsir');
    expect(provider.displayName).toBe('SMS.ir');
    expect(provider.isEnabled).toBe(true);
    expect(provider.supportsCapability(SmsCapability.SEND_SINGLE)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.SEND_BULK)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.SEND_LIKE_TO_LIKE)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.SEND_PATTERN)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.GET_DELIVERY)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.GET_BALANCE)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.GET_LINES)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.RECEIVE_MESSAGES)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.CANCEL_SCHEDULED)).toBe(true);
  });

  it('sends single SMS via sendBulk endpoint successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      status: 1,
      message: 'Success',
      data: {
        packId: 'pack-123',
        messageIds: [987654],
        cost: 15.5,
      },
    });

    const provider = new SmsirProvider(validConfig, mockTransport);
    const message = new SmsMessage({
      recipients: ['09123456789'],
      messageTexts: ['Test Single SMS.ir'],
      provider: 'smsir',
    });

    const res = await provider.sendSingle({ message });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe('987654');
    expect(res.packId).toBe('pack-123');
    expect(res.status).toBe(SmsStatus.SENT);
    expect(mockTransport).toHaveBeenCalledWith(
      'https://api.sms.ir/v1/send/bulk',
      'POST',
      expect.objectContaining({
        lineNumber: '300000000000',
        messageText: 'Test Single SMS.ir',
        mobiles: ['09123456789'],
      }),
      expect.anything(),
    );
  });

  it('sends bulk SMS successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      status: 1,
      message: 'Success',
      data: {
        packId: 'pack-bulk-1',
        messageIds: [111, 222],
        cost: 30,
      },
    });

    const provider = new SmsirProvider(validConfig, mockTransport);

    const res = await provider.sendBulk({
      lineNumber: '300000000000',
      messageText: 'Hello All',
      mobiles: ['09123456789', '09987654321'],
    });

    expect(res.success).toBe(true);
    expect(res.packId).toBe('pack-bulk-1');
    expect(res.messageIds).toEqual([111, 222]);
  });

  it('sends pattern SMS (verify) successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      status: 1,
      message: 'Success',
      data: {
        messageId: 554433,
        cost: 10,
      },
    });

    const provider = new SmsirProvider(validConfig, mockTransport);

    const res = await provider.sendPattern({
      mobile: '09123456789',
      templateId: 100000,
      parameters: [{ name: 'CODE', value: '123456' }],
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe('554433');
    expect(mockTransport).toHaveBeenCalledWith(
      'https://api.sms.ir/v1/send/verify',
      'POST',
      expect.objectContaining({
        mobile: '09123456789',
        templateId: 100000,
        parameters: [{ name: 'CODE', value: '123456' }],
      }),
      expect.anything(),
    );
  });

  it('gets credit balance successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      status: 1,
      message: 'Success',
      data: 750000,
    });

    const provider = new SmsirProvider(validConfig, mockTransport);

    const res = await provider.getBalance();

    expect(res.success).toBe(true);
    expect(res.balance).toBe(750000);
    expect(res.currency).toBe('IRR');
  });

  it('gets lines successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      status: 1,
      message: 'Success',
      data: [{ lineNumber: '300000000000', isDefault: true }],
    });

    const provider = new SmsirProvider(validConfig, mockTransport);

    const res = await provider.getLines();

    expect(res.success).toBe(true);
    expect(res.lines.length).toBe(1);
    expect(res.lines[0].lineNumber).toBe('300000000000');
  });

  it('cancels scheduled SMS successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      status: 1,
      message: 'Success',
      data: {
        returnedCreditCount: 100,
        smsCount: 10,
      },
    });

    const provider = new SmsirProvider(validConfig, mockTransport);

    const res = await provider.cancelScheduled({ packId: 'pack-99' });

    expect(res.success).toBe(true);
    expect(res.returnedCreditCount).toBe(100);
    expect(res.smsCount).toBe(10);
  });

  it('handles API error response status correctly', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      status: 101,
      message: 'X-API-KEY Invalid',
      data: null,
    });

    const provider = new SmsirProvider(validConfig, mockTransport);
    const message = new SmsMessage({
      recipients: ['09123456789'],
      messageTexts: ['Test Single SMS Error'],
      provider: 'smsir',
    });

    await expect(provider.sendSingle({ message })).rejects.toThrow('Authentication failed');
  });
});
