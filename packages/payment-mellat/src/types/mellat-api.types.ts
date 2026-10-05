export interface BpPayRequestParams {
  terminalId: number;
  userName: string;
  userPassword: string;
  orderId: number;
  amount: number;
  localDate: string;
  localTime: string;
  additionalData: string;
  callBackUrl: string;
  payerId: string;
  mobileNo?: string;
  encPan?: string;
  panHiddenMode?: string;
  cartItem?: string;
  enc?: string;
}

export interface BpVerifyRequestParams {
  terminalId: number;
  userName: string;
  userPassword: string;
  orderId: number;
  saleOrderId: number;
  saleReferenceId: number;
}

export interface BpSettleRequestParams {
  terminalId: number;
  userName: string;
  userPassword: string;
  orderId: number;
  saleOrderId: number;
  saleReferenceId: number;
}

export interface BpInquiryRequestParams {
  terminalId: number;
  userName: string;
  userPassword: string;
  orderId: number;
  saleOrderId: number;
  saleReferenceId: number;
}

export interface BpReversalRequestParams {
  terminalId: number;
  userName: string;
  userPassword: string;
  orderId: number;
  saleOrderId: number;
  saleReferenceId: number;
}

export interface BpRefundRequestParams {
  terminalId: number;
  userName: string;
  userPassword: string;
  orderId: number;
  saleOrderId: number;
  saleReferenceId: number;
  refundAmount: number;
}

export interface BpRefundToPANRequestParams {
  terminalId: number;
  User: string;
  Password: string;
  PAN?: number;
  SaleReferenceId?: number;
  Amount: number;
  orderId: number;
  mobileNumber?: string;
}

export interface MellatCallbackPayload {
  RefId?: string;
  ResCode?: string;
  SaleOrderId?: string;
  SaleReferenceId?: string;
  CardHolderPan?: string;
  CreditCardSaleResponseDetail?: string;
  FinalAmount?: string;
  [key: string]: unknown;
}
