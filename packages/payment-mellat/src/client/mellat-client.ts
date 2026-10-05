import { MellatConfig } from '../config/mellat-config.interface.js';
import {
  BpInquiryRequestParams,
  BpPayRequestParams,
  BpRefundRequestParams,
  BpRefundToPANRequestParams,
  BpReversalRequestParams,
  BpSettleRequestParams,
  BpVerifyRequestParams,
} from '../types/mellat-api.types.js';

export type HttpTransport = (
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body: string;
    timeoutMs?: number;
  },
) => Promise<{ statusCode: number; body: string }>;

export const DEFAULT_SOAP_URL = 'https://bpm.shaparak.ir/pgwchannel/services/pgw';
export const DEFAULT_PAYMENT_PAGE_URL = 'https://bpm.shaparak.ir/pgwchannel/startpay.mellat';
export const DEFAULT_TIMEOUT_MS = 20000;

export interface RedirectFormData {
  readonly actionUrl: string;
  readonly method: 'POST';
  readonly fields: Record<string, string>;
}

export class MellatClient {
  private readonly config: MellatConfig;
  private readonly soapUrl: string;
  private readonly paymentPageUrl: string;
  private readonly timeoutMs: number;
  private readonly transport: HttpTransport;

  constructor(config: MellatConfig, transport?: HttpTransport) {
    this.config = config;
    this.soapUrl = config.wsdlUrl ? config.wsdlUrl.replace(/\?wsdl$/i, '') : DEFAULT_SOAP_URL;
    this.paymentPageUrl = config.portalUrl || DEFAULT_PAYMENT_PAGE_URL;
    this.timeoutMs = config.requestTimeoutMs || DEFAULT_TIMEOUT_MS;

    this.transport = transport || MellatClient.defaultFetchTransport;
  }

  private static async defaultFetchTransport(
    url: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body: string;
      timeoutMs?: number;
    },
  ): Promise<{ statusCode: number; body: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });

      const bodyText = await response.text();
      return {
        statusCode: response.status,
        body: bodyText,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  public getPaymentPageUrl(): string {
    return this.paymentPageUrl;
  }

  public generateRedirectFormData(
    refId: string,
    additionalFields?: {
      mobileNo?: string;
      hiddenMode?: string;
      encPan?: string;
      enc?: string;
      merchantName?: string;
      merchantAddress?: string;
      cartItem?: string;
    },
  ): RedirectFormData {
    const fields: Record<string, string> = {
      RefId: refId,
    };

    if (additionalFields?.mobileNo) fields['MobileNo'] = additionalFields.mobileNo;
    if (additionalFields?.hiddenMode) fields['HiddenMode'] = additionalFields.hiddenMode;
    if (additionalFields?.encPan) fields['EncPan'] = additionalFields.encPan;
    if (additionalFields?.enc) fields['ENC'] = additionalFields.enc;
    if (additionalFields?.merchantName) fields['merchantName'] = additionalFields.merchantName;
    if (additionalFields?.merchantAddress)
      fields['merchantAddress'] = additionalFields.merchantAddress;
    if (additionalFields?.cartItem) fields['CartItem'] = additionalFields.cartItem;

    return {
      actionUrl: this.paymentPageUrl,
      method: 'POST',
      fields,
    };
  }

  public async payRequest(
    params: Omit<BpPayRequestParams, 'terminalId' | 'userName' | 'userPassword'>,
  ): Promise<{ resCode: string; refId?: string; rawResponse: string }> {
    const fullParams: BpPayRequestParams = {
      terminalId: Number(this.config.terminalId),
      userName: this.config.userName,
      userPassword: this.config.userPassword,
      ...params,
    };

    const xml = this.buildSoapEnvelope(
      'bpPayRequest',
      fullParams as unknown as Record<string, unknown>,
    );
    const responseBody = await this.sendSoapRequest(xml);
    const returnVal = this.extractReturnFromSoap(responseBody);

    const parts = returnVal.split(',').map((s) => s.trim());
    const resCode = parts[0] || returnVal;
    const refId = parts.length > 1 ? parts[1] : undefined;

    return {
      resCode,
      refId,
      rawResponse: responseBody,
    };
  }

  public async verifyRequest(
    params: Omit<BpVerifyRequestParams, 'terminalId' | 'userName' | 'userPassword'>,
  ): Promise<{ resCode: string; rawResponse: string }> {
    const fullParams: BpVerifyRequestParams = {
      terminalId: Number(this.config.terminalId),
      userName: this.config.userName,
      userPassword: this.config.userPassword,
      ...params,
    };

    const xml = this.buildSoapEnvelope(
      'bpVerifyRequest',
      fullParams as unknown as Record<string, unknown>,
    );
    const responseBody = await this.sendSoapRequest(xml);
    const resCode = this.extractReturnFromSoap(responseBody);

    return {
      resCode,
      rawResponse: responseBody,
    };
  }

  public async settleRequest(
    params: Omit<BpSettleRequestParams, 'terminalId' | 'userName' | 'userPassword'>,
  ): Promise<{ resCode: string; rawResponse: string }> {
    const fullParams: BpSettleRequestParams = {
      terminalId: Number(this.config.terminalId),
      userName: this.config.userName,
      userPassword: this.config.userPassword,
      ...params,
    };

    const xml = this.buildSoapEnvelope(
      'bpSettleRequest',
      fullParams as unknown as Record<string, unknown>,
    );
    const responseBody = await this.sendSoapRequest(xml);
    const resCode = this.extractReturnFromSoap(responseBody);

    return {
      resCode,
      rawResponse: responseBody,
    };
  }

  public async inquiryRequest(
    params: Omit<BpInquiryRequestParams, 'terminalId' | 'userName' | 'userPassword'>,
  ): Promise<{ resCode: string; rawResponse: string }> {
    const fullParams: BpInquiryRequestParams = {
      terminalId: Number(this.config.terminalId),
      userName: this.config.userName,
      userPassword: this.config.userPassword,
      ...params,
    };

    const xml = this.buildSoapEnvelope(
      'bpInquiryRequest',
      fullParams as unknown as Record<string, unknown>,
    );
    const responseBody = await this.sendSoapRequest(xml);
    const resCode = this.extractReturnFromSoap(responseBody);

    return {
      resCode,
      rawResponse: responseBody,
    };
  }

  public async reversalRequest(
    params: Omit<BpReversalRequestParams, 'terminalId' | 'userName' | 'userPassword'>,
  ): Promise<{ resCode: string; rawResponse: string }> {
    const fullParams: BpReversalRequestParams = {
      terminalId: Number(this.config.terminalId),
      userName: this.config.userName,
      userPassword: this.config.userPassword,
      ...params,
    };

    const xml = this.buildSoapEnvelope(
      'bpReversalRequest',
      fullParams as unknown as Record<string, unknown>,
    );
    const responseBody = await this.sendSoapRequest(xml);
    const resCode = this.extractReturnFromSoap(responseBody);

    return {
      resCode,
      rawResponse: responseBody,
    };
  }

  public async refundRequest(
    params: Omit<BpRefundRequestParams, 'terminalId' | 'userName' | 'userPassword'>,
  ): Promise<{ resCode: string; rawResponse: string }> {
    const fullParams: BpRefundRequestParams = {
      terminalId: Number(this.config.terminalId),
      userName: this.config.userName,
      userPassword: this.config.userPassword,
      ...params,
    };

    const xml = this.buildSoapEnvelope(
      'bpRefundRequest',
      fullParams as unknown as Record<string, unknown>,
    );
    const responseBody = await this.sendSoapRequest(xml);
    const resCode = this.extractReturnFromSoap(responseBody);

    return {
      resCode,
      rawResponse: responseBody,
    };
  }

  public async refundToPANRequest(
    params: Omit<BpRefundToPANRequestParams, 'terminalId' | 'User' | 'Password'>,
  ): Promise<{ resCode: string; referenceNumber?: string; rawResponse: string }> {
    const fullParams: BpRefundToPANRequestParams = {
      terminalId: Number(this.config.terminalId),
      User: this.config.userName,
      Password: this.config.userPassword,
      ...params,
    };

    const xml = this.buildSoapEnvelope(
      'bpRefundToPANRequest',
      fullParams as unknown as Record<string, unknown>,
    );
    const responseBody = await this.sendSoapRequest(xml);
    const returnVal = this.extractReturnFromSoap(responseBody);

    const parts = returnVal.split(',').map((s) => s.trim());
    const resCode = parts[0] || returnVal;
    const referenceNumber = parts.length > 1 ? parts[1] : undefined;

    return {
      resCode,
      referenceNumber,
      rawResponse: responseBody,
    };
  }

  private async sendSoapRequest(xmlBody: string): Promise<string> {
    const response = await this.transport(this.soapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '',
      },
      body: xmlBody,
      timeoutMs: this.timeoutMs,
    });

    if (response.statusCode >= 500) {
      throw new Error(`Mellat SOAP service returned server error HTTP ${response.statusCode}`);
    }

    return response.body;
  }

  private buildSoapEnvelope(operationName: string, params: Record<string, unknown>): string {
    let paramNodes = '';
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        paramNodes += `<${key}>${this.escapeXml(String(value))}</${key}>`;
      }
    }

    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:interfaces="http://interfaces.core.mcp.billing.tehran.ir/">
  <soapenv:Header/>
  <soapenv:Body>
    <interfaces:${operationName}>
      ${paramNodes}
    </interfaces:${operationName}>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private extractReturnFromSoap(xmlResponse: string): string {
    const match = xmlResponse.match(/<return>(.*?)<\/return>/s);
    if (match && match[1] !== undefined) {
      return match[1].trim();
    }
    return xmlResponse.trim();
  }

  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
