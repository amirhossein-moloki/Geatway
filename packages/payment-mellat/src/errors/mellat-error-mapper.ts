import {
  GatewayError,
  PaymentPlatformError,
  ValidationError,
} from '@amirhossein-moloki/payment-core';

export const MELLAT_ERROR_MAPPING: Record<
  string,
  { message: string; isValidationError?: boolean }
> = {
  '0': { message: 'تراکنش با موفقیت انجام شد' },
  '11': { message: 'شماره کارت نامعتبر است', isValidationError: true },
  '12': { message: 'موجودی کافی نیست' },
  '13': { message: 'رمز نادرست است', isValidationError: true },
  '14': { message: 'تعداد دفعات وارد کردن رمز بیش از حد مجاز است' },
  '15': { message: 'کارت نامعتبر است', isValidationError: true },
  '16': { message: 'دفعات برداشت وجه بیش از حد مجاز است' },
  '17': { message: 'کاربر از انجام تراکنش منصرف شده است' },
  '18': { message: 'تاریخ انقضای کارت گذشته است', isValidationError: true },
  '19': { message: 'مبلغ برداشت وجه بیش از حد مجاز است', isValidationError: true },
  '111': { message: 'صادر کننده کارت نامعتبر است', isValidationError: true },
  '112': { message: 'خطای سوییچ صادر کننده کارت' },
  '113': { message: 'پاسخی از صادرکننده کارت دریافت نشد' },
  '114': { message: 'دارنده کارت مجاز به انجام این تراکنش نیست' },
  '21': { message: 'پذیرنده نامعتبر است' },
  '23': { message: 'خطای امنیتی رخ داده است' },
  '24': { message: 'اطلاعات کاربری پذیرنده نامعتبر است' },
  '25': { message: 'مبلغ نامعتبر است', isValidationError: true },
  '31': { message: 'پاسخ نامعتبر است' },
  '32': { message: 'فرمت اطلاعات وارد شده صحیح نمی باشد', isValidationError: true },
  '33': { message: 'حساب نامعتبر است' },
  '34': { message: 'خطای سیستمی' },
  '35': { message: 'تاریخ نامعتبر است', isValidationError: true },
  '41': { message: 'شماره درخواست تکراری است' },
  '42': { message: 'تراکنش Sale یافت نشد' },
  '43': { message: 'قبلاً درخواست Verify داده شده است' },
  '44': { message: 'درخواست Verify یافت نشد' },
  '45': { message: 'تراکنش Settle شده است' },
  '46': { message: 'تراکنش Settle نشده است' },
  '47': { message: 'تراکنش Settle یافت نشد' },
  '48': { message: 'تراکنش Reverse شده است' },
  '51': { message: 'تراکنش تکراری است' },
  '54': { message: 'تراکنش مرجع موجود نیست' },
  '55': { message: 'تراکنش نامعتبر است' },
  '61': { message: 'خطا در واریز' },
  '62': { message: 'مسیر بازگشت به سایت در دامنه ثبت شده برای پذیرنده قرار ندارد' },
  '98': { message: 'سقف استفاده از رمز ایستا به پایان رسیده است' },
  '119': { message: 'مبلغ نامعتبر است', isValidationError: true },
  '412': { message: 'شناسه قبض نادرست است', isValidationError: true },
  '413': { message: 'شناسه پرداخت نادرست است', isValidationError: true },
  '414': { message: 'سازمان صادر کننده قبض نامعتبر است' },
  '415': { message: 'زمان جلسه کاری به پایان رسیده است' },
  '416': { message: 'خطا در ثبت اطلاعات' },
  '417': { message: 'شناسه پرداخت کننده نامعتبر است', isValidationError: true },
  '418': { message: 'اشکال در تعریف اطلاعات مشتری' },
  '419': { message: 'تعداد دفعات ورود اطلاعات از حد مجاز گذشته است' },
  '421': { message: 'IP نامعتبر است' },
  '995': { message: 'تعلق کارت بانکی به مشتری احراز نشد' },
};

export class MellatErrorMapper {
  public static mapCodeToError(
    code: string | number,
    gatewayId = 'mellat',
    customContextMessage?: string,
  ): PaymentPlatformError {
    const codeStr = String(code).trim();
    const errorInfo = MELLAT_ERROR_MAPPING[codeStr];

    const message = errorInfo
      ? `${customContextMessage ? `${customContextMessage}: ` : ''}${errorInfo.message} (code: ${codeStr})`
      : `${customContextMessage ? `${customContextMessage}: ` : ''}Mellat gateway error with code ${codeStr}`;

    if (errorInfo?.isValidationError) {
      return new ValidationError(message, {
        gatewayId,
        providerErrorCode: codeStr,
      });
    }

    return new GatewayError(message, gatewayId, codeStr, {
      providerErrorCode: codeStr,
    });
  }
}
