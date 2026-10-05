import { GatewayError, ValidationError } from '@company/payment-core';

export class SamanErrorMapper {
  private static readonly RESULT_MESSAGES: Record<number, string> = {
    0: 'عملیات با موفقیت انجام شد.',
    1: 'انصراف کاربر.',
    2: 'تراکنش با موفقیت انجام نشد.',
    3: 'اطلاعات ارسال شده ناقص یا اشتباه است.',
    4: 'مبلغ تراکنش معتبر نیست.',
    5: 'شناسه مرجع (RefNum) معتبر نیست.',
    6: 'ترمینال معتبر نیست.',
    7: 'تراکنش قبلا وریفای شده است.',
    8: 'تراکنش یافت نشد.',
    [-1]: 'خطای عمومی در سامانه.',
    [-2]: 'تراکنش یافت نشد یا مهلت زمانی آن منقضی شده است.',
    [-3]: 'ورودی‌ها نامعتبر می‌باشند.',
    [-4]: 'کارت خوانده نشد.',
    [-5]: 'موجودی کافی نیست.',
    [-6]: 'رمز اشتباه است.',
  };

  public static mapCodeToError(
    code: number | string,
    gatewayId: string,
    customMessage?: string,
  ): Error {
    const numCode = Number(code);
    const description = this.RESULT_MESSAGES[numCode] || `Saman error code ${code}`;
    const message = customMessage ? `${customMessage}: ${description}` : description;

    if ([3, 4, 5, 6, -3].includes(numCode)) {
      return new ValidationError(message, { gatewayId, code });
    }

    return new GatewayError(message, gatewayId, code, { code });
  }
}
