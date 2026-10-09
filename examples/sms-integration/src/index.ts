import {
  SmsProviderRegistry,
  SmsService,
  SmsMessage,
  SmsType,
  SmsPlatformError,
  SmsValidationError,
  SmsProviderNotFoundError,
} from '@amirhossein-moloki/sms-core';

export interface SendSingleDto {
  provider: string;
  recipient: string;
  text: string;
}

export interface SendOtpDto {
  provider: string;
  mobile: string;
  templateId: number;
  code: string;
}

export class SmsApplicationController {
  constructor(private readonly smsService: SmsService) {}

  async sendSingleSms(dto: SendSingleDto) {
    if (!dto.provider || !dto.recipient || !dto.text) {
      throw new SmsValidationError('Provider, recipient, and text are required fields');
    }

    const message = new SmsMessage({
      provider: dto.provider,
      type: SmsType.SINGLE,
      recipients: [dto.recipient],
      messageTexts: [dto.text],
    });

    const result = await this.smsService.sendSingle(message);
    return {
      success: result.response.success,
      messageId: result.response.messageId,
      status: result.message.status,
    };
  }

  async sendOtpSms(dto: SendOtpDto) {
    if (!dto.provider || !dto.mobile || !dto.templateId || !dto.code) {
      throw new SmsValidationError('Provider, mobile, templateId, and code are required fields');
    }

    const response = await this.smsService.sendPattern(dto.provider, {
      mobile: dto.mobile,
      templateId: dto.templateId,
      parameters: [{ name: 'CODE', value: dto.code }],
    });

    return {
      success: response.success,
      messageId: response.messageId,
    };
  }

  async getBalance(providerId: string) {
    if (!providerId) {
      throw new SmsValidationError('Provider ID is required');
    }

    const result = await this.smsService.getBalance(providerId);
    return {
      provider: providerId,
      balance: result.balance,
    };
  }
}

export function createSmsApplication(registry: SmsProviderRegistry) {
  const service = new SmsService(registry);
  const controller = new SmsApplicationController(service);

  return { service, controller };
}
