import { MelipayamakConfig } from '../config/melipayamak-config.interface.js';
import { MelipayamakApiResponse } from '../types/melipayamak-api.types.js';

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

export class MelipayamakClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly transport: HttpTransport;

  constructor(config: MelipayamakConfig, transport?: HttpTransport) {
    this.baseUrl = (config.baseUrl || 'https://rest.payamak-panel.com/api/SendSMS').replace(/\/+$/, '');
    this.username = config.username;
    this.password = config.password;
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
      ...options?.headers,
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'GET') {
      fetchOptions.body = JSON.stringify(data);
    }

    const res = await fetch(url, fetchOptions);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    return res.json();
  }

  public async post<T>(
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<MelipayamakApiResponse<T>> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
    const fullBody = {
      username: this.username,
      password: this.password,
      ...payload,
    };

    const result = await this.transport(url, 'POST', fullBody);
    return result as MelipayamakApiResponse<T>;
  }

  public async sendSms(
    to: string,
    from: string,
    text: string,
    isFlash: boolean = false,
  ): Promise<MelipayamakApiResponse<string | number>> {
    return this.post<string | number>('SendSMS', {
      to,
      from,
      text,
      isFlash,
    });
  }

  public async sendByBaseNumber(
    text: string | string[],
    to: string,
    bodyId: number | string,
  ): Promise<MelipayamakApiResponse<string | number>> {
    // Note: Melipayamak BaseService accepts text parameters (e.g. array or string) and bodyId
    const textParam = Array.isArray(text) ? text.join(';') : text;
    return this.post<string | number>('BaseServiceNumber', {
      text: textParam,
      to,
      bodyId: Number(bodyId),
    });
  }

  public async isDelivered(recId: string | number): Promise<MelipayamakApiResponse<string | number>> {
    return this.post<string | number>('GetDeliveries2', {
      recId: Number(recId),
    });
  }

  public async getCredit(): Promise<MelipayamakApiResponse<string | number>> {
    return this.post<string | number>('GetCredit', {});
  }

  public async getNumbers(): Promise<MelipayamakApiResponse<string[] | string>> {
    return this.post<string[] | string>('GetNumbers', {});
  }

  public async getMessages(
    location: number = 1,
    index: number = 0,
    count: number = 100,
    from: string = '',
  ): Promise<MelipayamakApiResponse<unknown>> {
    return this.post<unknown>('GetMessages', {
      location,
      index,
      count,
      from,
    });
  }
}
