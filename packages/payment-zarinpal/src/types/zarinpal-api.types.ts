export interface ZarinpalGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
}

export interface PaymentRequestData {
  PaymentRequest: {
    code: number;
    authority: string;
    fee_type?: string;
    fee?: number;
    message?: string;
  };
}

export interface PaymentVerificationData {
  PaymentVerification: {
    code: number;
    ref_id: number | string;
    card_pan?: string;
    card_hash?: string;
    fee_type?: string;
    fee?: number;
    message?: string;
  };
}

export interface ZarinpalCallbackPayload {
  Authority?: string;
  Status?: string;
  [key: string]: unknown;
}
