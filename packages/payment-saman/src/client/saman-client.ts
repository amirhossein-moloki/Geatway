import { SamanConfig } from '../config/saman-config.interface.js';
import {
  SamanGetTokenParams,
  SamanGetTokenPayload,
  SamanGetTokenResponse,
  SamanReverseParams,
  SamanReversePayload,
  SamanReverseResponse,
  SamanVerifyParams,
  SamanVerifyPayload,
  SamanVerifyResponse,
} from '../types/saman-api.types.js';

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

export class SamanClient {
  private readonly config: SamanConfig;
  private readonly tokenUrl: string;
  private readonly verifyUrl: string;
  private readonly reverseUrl: string;
  private readonly paymentFormUrl: string;
  private readonly transport: HttpTransport;

  constructor(config: SamanConfig, transport?: HttpTransport) {
    this.config = config;
    this.tokenUrl = config.tokenUrl || 'https://sep.shaparak.ir/OnlinePG/OnlinePG';
    this.verifyUrl =
      config.verifyUrl || 'https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/VerifyTranscation';
    this.reverseUrl =
      config.reverseUrl ||
      'https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/ReverseTranscation';
    this.paymentFormUrl = config.paymentFormUrl || 'https://sep.shaparak.ir/OnlinePG/SendToken';
    this.transport = transport || new DefaultHttpTransport();
  }

  public async getToken(payload: SamanGetTokenParams): Promise<SamanGetTokenResponse> {
    const body: SamanGetTokenPayload = {
      Action: 'Token',
      TerminalId: this.config.terminalId,
      RedirectUrl: this.config.redirectUrl,
      ResNum: payload.ResNum,
      Amount: payload.Amount,
      CellNumber: payload.CellNumber,
      ResNum1: payload.ResNum1,
      ResNum2: payload.ResNum2,
    };

    return this.transport.post<SamanGetTokenResponse>(this.tokenUrl, body);
  }

  public async verifyTransaction(payload: SamanVerifyParams): Promise<SamanVerifyResponse> {
    const body: SamanVerifyPayload = {
      TerminalNumber: this.config.terminalId,
      RefNum: payload.RefNum,
    };

    return this.transport.post<SamanVerifyResponse>(this.verifyUrl, body);
  }

  public async reverseTransaction(payload: SamanReverseParams): Promise<SamanReverseResponse> {
    const body: SamanReversePayload = {
      TerminalNumber: this.config.terminalId,
      RefNum: payload.RefNum,
    };

    return this.transport.post<SamanReverseResponse>(this.reverseUrl, body);
  }

  public getPaymentRedirectInfo(token: string): { url: string; form: { token: string } } {
    return {
      url: this.paymentFormUrl,
      form: { token },
    };
  }
}
