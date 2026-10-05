export interface SamanGetTokenParams {
  ResNum: string;
  Amount: number;
  CellNumber?: number | string;
  ResNum1?: string;
  ResNum2?: string;
}

export interface SamanGetTokenPayload extends SamanGetTokenParams {
  Action: 'Token';
  TerminalId: string;
  RedirectUrl: string;
}

export interface SamanGetTokenResponse {
  status: number | string;
  token?: string;
  errorCode?: number | string;
  errorDesc?: string;
  [key: string]: unknown;
}

export interface SamanVerifyParams {
  RefNum: string;
}

export interface SamanVerifyPayload extends SamanVerifyParams {
  TerminalNumber: string | number;
}

export interface SamanVerifyResponse {
  ResultCode: number | string;
  ResultDescription?: string;
  TransactionDetail?: {
    Rrn?: string;
    RefNum?: string;
    MaskedPan?: string;
    HashedPan?: string;
    StraceNo?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface SamanReverseParams {
  RefNum: string;
}

export interface SamanReversePayload extends SamanReverseParams {
  TerminalNumber: string | number;
}

export interface SamanReverseResponse {
  ResultCode: number | string;
  ResultDescription?: string;
  [key: string]: unknown;
}

export interface SamanCallbackPayload {
  State?: string;
  Status?: string | number;
  Rrn?: string;
  RefNum?: string;
  ResNum?: string;
  TerminalId?: string;
  TraceNo?: string;
  Amount?: string | number;
  SecurePan?: string;
  [key: string]: unknown;
}
