import { ZibalConfig } from '../config/zibal-config.interface.js';
import {
  ZibalInquiryPayload,
  ZibalInquiryResponse,
  ZibalRequestPayload,
  ZibalRequestResponse,
  ZibalVerifyPayload,
  ZibalVerifyResponse,
} from '../types/zibal-api.types.js';

export interface HttpTransport {
  post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T>;
}

export class DefaultHttpTransport implements HttpTransport {
  public async post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }

    return (await res.json()) as T;
  }
}

export class ZibalClient {
  private readonly config: ZibalConfig;
  private readonly baseUrl: string;
  private readonly transport: HttpTransport;

  constructor(config: ZibalConfig, transport?: HttpTransport) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://gateway.zibal.ir';
    this.transport = transport || new DefaultHttpTransport();
  }

  public async requestPayment(
    payload: Omit<ZibalRequestPayload, 'merchant'>,
    isLazy = false,
  ): Promise<ZibalRequestResponse> {
    const endpoint = isLazy ? '/request/lazy' : '/v1/request';
    const body: ZibalRequestPayload = {
      merchant: this.config.merchant,
      ...payload,
    };

    const response = await this.transport.post<ZibalRequestResponse>(
      `${this.baseUrl}${endpoint}`,
      body,
    );

    return {
      ...response,
      rawResponse: response,
    };
  }

  public async verifyPayment(
    payload: Omit<ZibalVerifyPayload, 'merchant'>,
    isLazy = false,
  ): Promise<ZibalVerifyResponse> {
    const endpoint = isLazy ? '/verify' : '/v1/verify';
    const body: ZibalVerifyPayload = {
      merchant: this.config.merchant,
      ...payload,
    };

    const response = await this.transport.post<ZibalVerifyResponse>(
      `${this.baseUrl}${endpoint}`,
      body,
    );

    return {
      ...response,
      rawResponse: response,
    };
  }

  public async inquiryPayment(
    payload: Omit<ZibalInquiryPayload, 'merchant'>,
  ): Promise<ZibalInquiryResponse> {
    const body: ZibalInquiryPayload = {
      merchant: this.config.merchant,
      ...payload,
    };

    const response = await this.transport.post<ZibalInquiryResponse>(
      `${this.baseUrl}/v1/inquiry`,
      body,
    );

    return {
      ...response,
      rawResponse: response,
    };
  }

  public getPaymentUrl(trackId: number | string): string {
    return `${this.baseUrl}/start/${trackId}`;
  }
}
