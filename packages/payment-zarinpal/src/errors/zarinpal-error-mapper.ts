import { GatewayError, ValidationError } from '@amirhossein-moloki/payment-core';

export class ZarinpalErrorMapper {
  private static readonly CODE_MESSAGES: Record<number, string> = {
    100: 'عملیات با موفقیت انجام شد.',
    101: 'عملیات پرداخت موفق بوده و قبلاً وریفای شده است.',
    [-9]: 'خطای خطای اعتبار سنجی.',
    [-10]: 'ای پی و يا مرچنت كد پذيرنده صحيح نيست.',
    [-11]: 'مرچنت کد فعال نیست.',
    [-12]: 'تلاش بیش از حد در یک بازه زمانی کوتاه.',
    [-15]: 'ترمینال شما به حالت تعلیق در آمده است.',
    [-16]: 'سطح تایید پذیرنده پایین تر از سطح نقره ای است.',
    [-30]: 'پذیرنده اجازه دسترسی به تسویه اشتراکی را ندارد.',
    [-31]: 'حساب بانکی تسویه را به پنل اضافه کنید.',
    [-32]: 'مجموع درصدهای تسهیم از ۱۰۰ بیشتر است.',
    [-33]: 'درصدهای وارد شده صحیح نیستند.',
    [-34]: 'مبلغ از سقف تقسیم بیشتر است.',
    [-35]: 'تعداد افراد دریافت کننده بیشتر از حد مجاز است.',
    [-40]: 'پارامترهای اضافی نامعتبر است.',
    [-50]: 'مبلغ پرداخت شده با مقدار وریفای متفاوت است.',
    [-51]: 'پرداخت ناموفق.',
    [-52]: 'خطای غیرمنتظره.',
    [-53]: 'اتصال اتوریتی به این مرچنت مقدور نیست.',
    [-54]: 'اتوریتی نامعتبر است.',
  };

  public static mapCodeToError(code: number, gatewayId: string, customMessage?: string): Error {
    const description = this.CODE_MESSAGES[code] || `Zarinpal error code ${code}`;
    const message = customMessage ? `${customMessage}: ${description}` : description;

    if (
      [-9, -10, -11, -12, -15, -16, -30, -31, -32, -33, -34, -35, -40, -50, -53, -54].includes(code)
    ) {
      return new ValidationError(message, { gatewayId, code });
    }

    return new GatewayError(message, gatewayId, code, { code });
  }
}
