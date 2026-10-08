import {
  SmsPlatformError,
  SmsProviderError,
  SmsValidationError,
} from '@amirhossein-moloki/sms-core';

export class SmsirErrorMapper {
  public static mapStatusToError(
    status: number,
    message: string,
    providerId: string,
    fallbackMessage: string = 'SMS.ir API operation failed',
  ): SmsPlatformError {
    switch (status) {
      case 101:
      case 102:
        return new SmsProviderError(
          `Authentication failed: ${message} (status ${status})`,
          providerId,
          status,
        );
      case 103:
      case 104:
        return new SmsProviderError(
          `Insufficient credit: ${message} (status ${status})`,
          providerId,
          status,
        );
      case 105:
      case 106:
      case 107:
        return new SmsValidationError(`Validation error: ${message} (status ${status})`);
      default:
        return new SmsProviderError(
          `${fallbackMessage}: ${message || 'Unknown status'} (status ${status})`,
          providerId,
          status,
        );
    }
  }
}
