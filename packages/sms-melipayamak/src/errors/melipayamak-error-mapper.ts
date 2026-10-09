import {
  SmsPlatformError,
  SmsProviderError,
  SmsValidationError,
} from '@amirhossein-moloki/sms-core';

export class MelipayamakErrorMapper {
  public static mapCodeToError(
    code: number | string,
    providerId: string,
    fallbackMessage: string = 'Melipayamak API operation failed',
  ): SmsPlatformError {
    const numCode = Number(code);

    switch (numCode) {
      case 2:
      case 35:
        return new SmsProviderError(`Authentication failed: code ${numCode}`, providerId, numCode);
      case 3:
      case 14:
        return new SmsProviderError(`Insufficient credit: code ${numCode}`, providerId, numCode);
      case 4:
      case 5:
      case 6:
      case 7:
      case 8:
      case 9:
      case 11:
      case 12:
        return new SmsValidationError(`Invalid parameters: code ${numCode}`);
      default:
        return new SmsProviderError(`${fallbackMessage} (code: ${code})`, providerId, code);
    }
  }
}
