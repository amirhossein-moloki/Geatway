import { ZarinpalConfig } from '../config/zarinpal-config.interface.js';
import {
  PaymentRequestData,
  PaymentVerificationData,
  ZarinpalGraphQLResponse,
} from '../types/zarinpal-api.types.js';

export interface HttpTransport {
  post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T>;
}

export class DefaultHttpTransport implements HttpTransport {
  public async post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
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

export class ZarinpalClient {
  private readonly config: ZarinpalConfig;
  private readonly graphqlUrl: string;
  private readonly startPayUrl: string;
  private readonly transport: HttpTransport;

  constructor(config: ZarinpalConfig, transport?: HttpTransport) {
    this.config = config;
    this.graphqlUrl = config.baseUrl || 'https://next.zarinpal.com/api/v4/graphql';
    this.startPayUrl = config.startPayUrl || 'https://www.zarinpal.com/pg/StartPay/';
    this.transport = transport || new DefaultHttpTransport();
  }

  public async requestPayment(params: {
    merchantId?: string;
    amount: number;
    callbackUrl: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ZarinpalGraphQLResponse<PaymentRequestData>> {
    const merchant = params.merchantId || this.config.merchantId || '';
    const query = `
      mutation PaymentRequest($merchantId: String!, $amount: Int!, $callbackUrl: String!, $description: String, $metadata: String) {
        PaymentRequest(merchant_id: $merchantId, amount: $amount, callback_url: $callbackUrl, description: $description, metadata: $metadata) {
          code
          authority
          fee_type
          fee
          message
        }
      }
    `;

    const variables = {
      merchantId: merchant,
      amount: params.amount,
      callbackUrl: params.callbackUrl,
      description: params.description || '',
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    };

    return this.transport.post<ZarinpalGraphQLResponse<PaymentRequestData>>(
      this.graphqlUrl,
      { query, variables },
      { Authorization: `Bearer ${this.config.accessToken}` },
    );
  }

  public async verifyPayment(params: {
    merchantId?: string;
    amount: number;
    authority: string;
  }): Promise<ZarinpalGraphQLResponse<PaymentVerificationData>> {
    const merchant = params.merchantId || this.config.merchantId || '';
    const query = `
      mutation PaymentVerification($merchantId: String!, $amount: Int!, $authority: String!) {
        PaymentVerification(merchant_id: $merchantId, amount: $amount, authority: $authority) {
          code
          ref_id
          card_pan
          card_hash
          fee_type
          fee
          message
        }
      }
    `;

    const variables = {
      merchantId: merchant,
      amount: params.amount,
      authority: params.authority,
    };

    return this.transport.post<ZarinpalGraphQLResponse<PaymentVerificationData>>(
      this.graphqlUrl,
      { query, variables },
      { Authorization: `Bearer ${this.config.accessToken}` },
    );
  }

  public getStartPayUrl(authority: string): string {
    return `${this.startPayUrl}${authority}`;
  }
}
