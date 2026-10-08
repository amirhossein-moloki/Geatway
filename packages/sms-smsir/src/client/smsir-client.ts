import { SmsirConfig } from '../config/smsir-config.interface.js';
import {
  SmsirApiResponse,
  SmsirCancelScheduledData,
  SmsirDeliveryDataItem,
  SmsirLineData,
  SmsirReceiveMessageItem,
  SmsirSendBulkData,
  SmsirVerifyData,
} from '../types/smsir-api.types.js';

export interface HttpTransportOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export type HttpTransport = (
  url: string,
  method: string,
  data?: Record<string, unknown>,
  options?: HttpTransportOptions,
) => Promise<unknown>;

export class SmsirClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly transport: HttpTransport;

  constructor(config: SmsirConfig, transport?: HttpTransport) {
    this.baseUrl = (config.baseUrl || 'https://api.sms.ir').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.transport = transport || this.defaultFetchTransport;
  }

  private async defaultFetchTransport(
    url: string,
    method: string,
    data?: Record<string, unknown>,
    options?: HttpTransportOptions,
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-KEY': this.apiKey,
      ...options?.headers,
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'GET' && method !== 'DELETE') {
      fetchOptions.body = JSON.stringify(data);
    }

    const res = await fetch(url, fetchOptions);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    return res.json();
  }

  public async request<T>(
    endpoint: string,
    method: string = 'GET',
    data?: Record<string, unknown>,
  ): Promise<SmsirApiResponse<T>> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
    const result = await this.transport(url, method, data, {
      headers: { 'X-API-KEY': this.apiKey },
    });
    return result as SmsirApiResponse<T>;
  }

  public async sendBulk(payload: {
    lineNumber: string | number;
    messageText: string;
    mobiles: string[];
    sendDateTime?: number | null;
  }): Promise<SmsirApiResponse<SmsirSendBulkData>> {
    return this.request<SmsirSendBulkData>('v1/send/bulk', 'POST', payload);
  }

  public async sendLikeToLike(payload: {
    lineNumber: string | number;
    messageTexts: string[];
    mobiles: string[];
    sendDateTime?: number | null;
  }): Promise<SmsirApiResponse<SmsirSendBulkData>> {
    return this.request<SmsirSendBulkData>('v1/send/likeToLike', 'POST', payload);
  }

  public async verify(payload: {
    mobile: string;
    templateId: number | string;
    parameters: Array<{ name: string; value: string }>;
  }): Promise<SmsirApiResponse<SmsirVerifyData>> {
    return this.request<SmsirVerifyData>('v1/send/verify', 'POST', {
      mobile: payload.mobile,
      templateId: Number(payload.templateId),
      parameters: payload.parameters,
    });
  }

  public async getMessageReport(messageId: string | number): Promise<SmsirApiResponse<SmsirDeliveryDataItem>> {
    return this.request<SmsirDeliveryDataItem>(`v1/send/${messageId}`, 'GET');
  }

  public async getPackReport(
    packId: string,
    pageNumber: number = 1,
    pageSize: number = 100,
  ): Promise<SmsirApiResponse<SmsirDeliveryDataItem[]>> {
    return this.request<SmsirDeliveryDataItem[]>(
      `v1/send/pack/${packId}?pageNumber=${pageNumber}&pageSize=${pageSize}`,
      'GET',
    );
  }

  public async getLiveReport(
    pageNumber: number = 1,
    pageSize: number = 100,
  ): Promise<SmsirApiResponse<SmsirDeliveryDataItem[]>> {
    return this.request<SmsirDeliveryDataItem[]>(
      `v1/send/live?pageNumber=${pageNumber}&pageSize=${pageSize}`,
      'GET',
    );
  }

  public async getCredit(): Promise<SmsirApiResponse<number>> {
    return this.request<number>('v1/credit', 'GET');
  }

  public async getLines(): Promise<SmsirApiResponse<SmsirLineData[]>> {
    return this.request<SmsirLineData[]>('v1/line', 'GET');
  }

  public async getLatestReceived(count: number = 100): Promise<SmsirApiResponse<SmsirReceiveMessageItem[]>> {
    return this.request<SmsirReceiveMessageItem[]>(`v1/receive/latest?count=${count}`, 'GET');
  }

  public async cancelScheduled(
    packId: string,
  ): Promise<SmsirApiResponse<SmsirCancelScheduledData>> {
    return this.request<SmsirCancelScheduledData>(`v1/send/scheduled/${packId}`, 'DELETE');
  }
}
