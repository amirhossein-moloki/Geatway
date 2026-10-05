export enum PaymentStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  REDIRECTED = 'REDIRECTED',
  CALLBACK_RECEIVED = 'CALLBACK_RECEIVED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REVERSED = 'REVERSED',
  REFUNDED = 'REFUNDED',
}

const VALID_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.CREATED]: [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
  [PaymentStatus.PENDING]: [
    PaymentStatus.REDIRECTED,
    PaymentStatus.CALLBACK_RECEIVED,
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.REDIRECTED]: [
    PaymentStatus.CALLBACK_RECEIVED,
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.CALLBACK_RECEIVED]: [
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.SUCCESS]: [PaymentStatus.REFUNDED, PaymentStatus.REVERSED],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.REVERSED]: [],
  [PaymentStatus.REFUNDED]: [],
};

export class PaymentStateMachine {
  public static canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    if (from === to) {
      return true;
    }
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  public static getAllowedTransitions(from: PaymentStatus): readonly PaymentStatus[] {
    return VALID_TRANSITIONS[from] ?? [];
  }
}
