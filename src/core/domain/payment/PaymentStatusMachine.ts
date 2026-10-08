import { PaymentStatus } from '../enums';

export const VALID_STATUS_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> =
  Object.freeze({
    [PaymentStatus.CREATED]: Object.freeze([
      PaymentStatus.PENDING,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
    ]),
    [PaymentStatus.PENDING]: Object.freeze([
      PaymentStatus.REDIRECTED,
      PaymentStatus.CALLBACK_RECEIVED,
      PaymentStatus.SUCCESS,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
    ]),
    [PaymentStatus.REDIRECTED]: Object.freeze([
      PaymentStatus.CALLBACK_RECEIVED,
      PaymentStatus.SUCCESS,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
    ]),
    [PaymentStatus.CALLBACK_RECEIVED]: Object.freeze([
      PaymentStatus.SUCCESS,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
    ]),
    [PaymentStatus.SUCCESS]: Object.freeze([PaymentStatus.REFUNDED, PaymentStatus.REVERSED]),
    [PaymentStatus.FAILED]: Object.freeze([]),
    [PaymentStatus.CANCELLED]: Object.freeze([]),
    [PaymentStatus.REVERSED]: Object.freeze([]),
    [PaymentStatus.REFUNDED]: Object.freeze([]),
  });

export class PaymentStatusMachine {
  public static canTransition(currentStatus: PaymentStatus, targetStatus: PaymentStatus): boolean {
    if (currentStatus === targetStatus) {
      return true;
    }
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    return allowedTransitions ? allowedTransitions.includes(targetStatus) : false;
  }

  public static isTerminal(status: PaymentStatus): boolean {
    const allowed = VALID_STATUS_TRANSITIONS[status];
    return !allowed || allowed.length === 0;
  }
}
