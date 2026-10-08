import { describe, expect, it } from 'vitest';
import { SmsMessage } from '../src/core/domain/sms/sms-message.entity.js';
import { SmsStatus } from '../src/core/domain/sms/sms-status.enum.js';
import { SmsType } from '../src/core/domain/sms/sms-type.enum.js';
import { InvalidSmsStateError, SmsValidationError } from '../src/core/errors/index.js';

describe('SmsMessage Entity', () => {
  it('should create an SmsMessage with default values', () => {
    const msg = new SmsMessage({
      recipients: ['09123456789'],
      messageTexts: ['Hello World'],
    });

    expect(msg.id).toBeDefined();
    expect(msg.id.startsWith('sms_')).toBe(true);
    expect(msg.status).toBe(SmsStatus.PENDING);
    expect(msg.type).toBe(SmsType.SINGLE);
    expect(msg.recipients).toEqual(['09123456789']);
    expect(msg.messageTexts).toEqual(['Hello World']);
    expect(msg.sentAt).toBeNull();
    expect(msg.deliveredAt).toBeNull();
    expect(msg.createdAt).toBeInstanceOf(Date);
    expect(msg.updatedAt).toBeInstanceOf(Date);
  });

  it('should throw SmsValidationError if recipients list is empty', () => {
    expect(
      () =>
        new SmsMessage({
          recipients: [],
          messageTexts: ['Test'],
        }),
    ).toThrow(SmsValidationError);
  });

  it('should transition through valid statuses and update timestamps', () => {
    const msg = new SmsMessage({
      provider: 'sms-ir',
      recipients: ['09123456789'],
      messageTexts: ['OTP: 1234'],
    });

    expect(msg.status).toBe(SmsStatus.PENDING);

    msg.transitionTo(SmsStatus.SENT);
    expect(msg.status).toBe(SmsStatus.SENT);
    expect(msg.sentAt).toBeInstanceOf(Date);

    msg.transitionTo(SmsStatus.DELIVERED);
    expect(msg.status).toBe(SmsStatus.DELIVERED);
    expect(msg.deliveredAt).toBeInstanceOf(Date);
  });

  it('should throw InvalidSmsStateError for invalid status transitions', () => {
    const msg = new SmsMessage({
      recipients: ['09123456789'],
      messageTexts: ['Test'],
    });

    msg.transitionTo(SmsStatus.CANCELLED);
    expect(msg.status).toBe(SmsStatus.CANCELLED);

    expect(() => msg.transitionTo(SmsStatus.SENT)).toThrow(InvalidSmsStateError);
  });

  it('should correctly serialize to JSON', () => {
    const msg = new SmsMessage({
      id: 'sms_123',
      provider: 'sms-ir',
      recipients: ['09123456789'],
      messageTexts: ['Test Message'],
      patternId: 100,
      patternParameters: [{ name: 'CODE', value: '5555' }],
    });

    const json = msg.toJSON();
    expect(json.id).toBe('sms_123');
    expect(json.provider).toBe('sms-ir');
    expect(json.recipients).toEqual(['09123456789']);
    expect(json.patternId).toBe(100);
    expect(json.status).toBe(SmsStatus.PENDING);
  });
});
