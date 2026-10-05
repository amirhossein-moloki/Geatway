export interface ZibalMultiplexingInfo {
  bankAccount?: string;
  subMerchantId?: string;
  walletID?: number;
  amount?: number;
  wagePayer?: boolean;
}

export interface ZibalRequestPayload {
  merchant: string;
  amount: number; // In Rials
  callbackUrl: string;
  description?: string;
  orderId?: string;
  mobile?: string;
  allowedCards?: string[];
  nationalCode?: string;
  checkMobileWithCard?: boolean;
  percentMode?: number;
  feeMode?: number;
  multiplexingInfos?: ZibalMultiplexingInfo[];
}

export interface ZibalRequestResponse {
  trackId: number;
  result: number;
  message: string;
  rawResponse?: unknown;
}

export interface ZibalVerifyPayload {
  merchant: string;
  trackId: number;
}

export interface ZibalVerifyResponse {
  paidAt?: string;
  cardNumber?: string;
  status?: number;
  amount?: number;
  refNumber?: number;
  description?: string;
  orderId?: string;
  result: number;
  message: string;
  multiplexingInfos?: ZibalMultiplexingInfo[];
  rawResponse?: unknown;
}

export interface ZibalInquiryPayload {
  merchant: string;
  trackId: number;
}

export interface ZibalInquiryResponse {
  createdAt?: string;
  paidAt?: string;
  verifiedAt?: string;
  cardNumber?: string;
  status?: number;
  amount?: number;
  refNumber?: number;
  description?: string;
  orderId?: string;
  wage?: number;
  result: number;
  message: string;
  multiplexingInfos?: ZibalMultiplexingInfo[];
  rawResponse?: unknown;
}

export interface ZibalCallbackPayload {
  success?: string | number;
  trackId?: string | number;
  orderId?: string;
  status?: string | number;
  cardNumber?: string;
  hashedCardNumber?: string;
  [key: string]: unknown;
}
