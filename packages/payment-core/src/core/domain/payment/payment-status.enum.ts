export enum PaymentStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  REDIRECTED = 'REDIRECTED',
  CALLBACK_RECEIVED = 'CALLBACK_RECEIVED',
  AUTHORIZED = 'AUTHORIZED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REVERSED = 'REVERSED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

const VALID_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.CREATED]: [
    PaymentStatus.PENDING,
    PaymentStatus.AUTHORIZED,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.PENDING]: [
    PaymentStatus.REDIRECTED,
    PaymentStatus.CALLBACK_RECEIVED,
    PaymentStatus.AUTHORIZED,
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.REDIRECTED]: [
    PaymentStatus.CALLBACK_RECEIVED,
    PaymentStatus.AUTHORIZED,
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.CALLBACK_RECEIVED]: [
    PaymentStatus.AUTHORIZED,
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.AUTHORIZED]: [
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.REVERSED,
  ],
  [PaymentStatus.SUCCESS]: [
    PaymentStatus.REFUNDED,
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REVERSED,
  ],
  [PaymentStatus.PARTIALLY_REFUNDED]: [
    PaymentStatus.REFUNDED,
    PaymentStatus.PARTIALLY_REFUNDED,
  ],
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
