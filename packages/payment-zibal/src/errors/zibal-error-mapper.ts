import { GatewayError, ValidationError } from '@company/payment-core';

export class ZibalErrorMapper {
  private static readonly RESULT_MESSAGES: Record<number, string> = {
    100: 'با موفقیت انجام شد / تایید شد.',
    102: 'merchant یافت نشد.',
    103: 'merchant غیرفعال / عدم امضا قرارداد درگاه مربوطه.',
    104: 'merchant نامعتبر.',
    105: 'amount بایستی بزرگتر از 1,000 ریال باشد.',
    106: 'callbackUrl نامعتبر می‌باشد.',
    107: 'percentMode نامعتبر می‌باشد.',
    108: 'یک یا چند ذی‌نفع در multiplexingInfos نامعتبر می‌باشند.',
    109: 'یک یا چند ذی‌نفع در multiplexingInfos غیرفعال می‌باشند.',
    110: 'id = self در multiplexingInfos وجود ندارد.',
    111: 'amount با مجموع سهم‌ها در multiplexingInfos برابر نمی‌باشد.',
    112: 'موجودی کیف پول کارمزد جهت کسر کارمزد کافی نیست.',
    113: 'مبلغ تراکنش از سقف میزان تراکنش بیشتر است.',
    114: 'کدملی ارسالی نامعتبر است.',
    115: 'ip شما در پنل کاربری ثبت نشده است.',
    116: 'feeMode نامعتبر می‌باشد.',
    201: 'قبلا تایید شده.',
    202: 'سفارش پرداخت نشده یا ناموفق بوده است.',
    203: 'trackId نامعتبر می‌باشد.',
  };

  public static mapResultToError(result: number, gatewayId: string, customMessage?: string): Error {
    const description = this.RESULT_MESSAGES[result] || `Zibal error code ${result}`;
    const message = customMessage ? `${customMessage}: ${description}` : description;

    if (
      [102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 203].includes(
        result,
      )
    ) {
      return new ValidationError(message, { gatewayId, result });
    }

    return new GatewayError(message, gatewayId, result, { result });
  }
}
