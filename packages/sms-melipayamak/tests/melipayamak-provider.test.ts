import { describe, expect, it, vi } from 'vitest';
import { SmsCapability, SmsMessage, SmsStatus, SmsValidationError } from '@amirhossein-moloki/sms-core';
import { MelipayamakProvider } from '../src/provider/melipayamak-provider.js';
import { HttpTransport } from '../src/client/melipayamak-client.js';

describe('MelipayamakProvider Unit Tests', () => {
  const validConfig = {
    username: 'test_user',
    password: 'test_password',
    from: '50001234',
  };

  it('throws validation error if username or password is missing', () => {
    expect(() => new MelipayamakProvider({ username: '', password: 'p' })).toThrow(SmsValidationError);
    expect(() => new MelipayamakProvider({ username: 'u', password: '' })).toThrow(SmsValidationError);
  });

  it('correctly initializes capabilities and metadata', () => {
    const provider = new MelipayamakProvider(validConfig);
    expect(provider.id).toBe('melipayamak');
    expect(provider.displayName).toContain('Melipayamak');
    expect(provider.isEnabled).toBe(true);
    expect(provider.supportsCapability(SmsCapability.SEND_SINGLE)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.SEND_PATTERN)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.GET_DELIVERY)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.GET_BALANCE)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.GET_LINES)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.RECEIVE_MESSAGES)).toBe(true);
    expect(provider.supportsCapability(SmsCapability.SEND_BULK)).toBe(false);
  });

  it('sends single SMS successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      Value: '12345678',
      RetStatus: 1,
      StrRetStatus: 'Ok',
    });

    const provider = new MelipayamakProvider(validConfig, mockTransport);
    const message = new SmsMessage({
      recipients: ['09123456789'],
      messageTexts: ['Test Single SMS'],
      provider: 'melipayamak',
    });

    const res = await provider.sendSingle({ message });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe('12345678');
    expect(res.status).toBe(SmsStatus.SENT);
    expect(mockTransport).toHaveBeenCalledWith(
      'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
      'POST',
      expect.objectContaining({
        username: 'test_user',
        password: 'test_password',
        to: '09123456789',
        from: '50001234',
        text: 'Test Single SMS',
      }),
    );
  });

  it('sends pattern SMS successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      Value: '87654321',
      RetStatus: 1,
      StrRetStatus: 'Ok',
    });

    const provider = new MelipayamakProvider(validConfig, mockTransport);

    const res = await provider.sendPattern({
      mobile: '09123456789',
      templateId: '12345',
      parameters: [{ name: 'code', value: '998877' }],
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe('87654321');
    expect(mockTransport).toHaveBeenCalledWith(
      'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber',
      'POST',
      expect.objectContaining({
        username: 'test_user',
        password: 'test_password',
        to: '09123456789',
        bodyId: 12345,
        text: '998877',
      }),
    );
  });

  it('gets delivery status successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      Value: 1,
      RetStatus: 1,
      StrRetStatus: 'Delivered',
    });

    const provider = new MelipayamakProvider(validConfig, mockTransport);

    const res = await provider.getDeliveryStatus({ messageId: '12345678' });

    expect(res.success).toBe(true);
    expect(res.statuses[0].deliveryStatus).toBe(SmsStatus.DELIVERED);
  });

  it('gets credit balance successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      Value: 500000,
      RetStatus: 1,
      StrRetStatus: 'Ok',
    });

    const provider = new MelipayamakProvider(validConfig, mockTransport);

    const res = await provider.getBalance();

    expect(res.success).toBe(true);
    expect(res.balance).toBe(500000);
    expect(res.currency).toBe('IRR');
  });

  it('gets line numbers successfully', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      Value: ['50001234', '50005678'],
      RetStatus: 1,
      StrRetStatus: 'Ok',
    });

    const provider = new MelipayamakProvider(validConfig, mockTransport);

    const res = await provider.getLines();

    expect(res.success).toBe(true);
    expect(res.lines.length).toBe(2);
    expect(res.lines[0].lineNumber).toBe('50001234');
  });

  it('handles API error codes correctly', async () => {
    const mockTransport: HttpTransport = vi.fn().mockResolvedValue({
      Value: 0,
      RetStatus: 2,
      StrRetStatus: 'Invalid auth',
    });

    const provider = new MelipayamakProvider(validConfig, mockTransport);
    const message = new SmsMessage({
      recipients: ['09123456789'],
      messageTexts: ['Test Single SMS Error'],
      provider: 'melipayamak',
    });

    await expect(provider.sendSingle({ message })).rejects.toThrow('Authentication failed');
  });
});
