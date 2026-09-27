import { AccountingCoreError, type AccountingMessage, type SendMessageInput, type SyncTenantInput } from "./types";

export interface AccountingClientOptions {
  /** Accounting Core's base URL, e.g. https://accounting-core.vercel.app */
  baseUrl: string;
  /**
   * This app's own server-to-server API key (ACCOUNTING_CORE_API_KEY). Must
   * only ever be read from a server-only env var — never pass a value that
   * originated from the browser. The Core derives this app's identity
   * entirely from which key hash matches; there is no separate "app id"
   * parameter anywhere in this client, by design.
   */
  apiKey: string;
  /** Defaults to 10000ms — every call is guarded so a Core outage can't hang
   *  the caller forever, matching this app family's existing withTimeout convention. */
  timeoutMs?: number;
}

const ACCOUNTANT_FEATURE = "accountant_service";

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export class AccountingClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(options: AccountingClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await withTimeout(
      fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
          ...init.headers,
        },
      }),
      this.timeoutMs,
      `Accounting Core request timed out: ${path}`
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AccountingCoreError(body.error ?? `Accounting Core request failed (${res.status})`, res.status);
    }
    return res.json() as Promise<T>;
  }

  /** Call whenever the business's profile is created or edited. Idempotent. */
  async syncTenant(input: SyncTenantInput): Promise<{ tenantId: string }> {
    return this.request("/api/v1/tenants/sync", { method: "POST", body: JSON.stringify(input) });
  }

  /** Whether this business has the Accountant Service feature enabled. Use this
   *  to decide whether to render the "רואה החשבון שלי" area at all. */
  async isAccountantServiceEnabled(externalTenantId: string): Promise<boolean> {
    const qs = new URLSearchParams({ externalTenantId, feature: ACCOUNTANT_FEATURE });
    const { entitled } = await this.request<{ entitled: boolean }>(`/api/v1/entitlements/check?${qs}`);
    return entitled;
  }

  async sendMessage(input: SendMessageInput): Promise<{ id: string; createdAt: string }> {
    return this.request("/api/v1/messages", { method: "POST", body: JSON.stringify(input) });
  }

  async listMessages(externalTenantId: string): Promise<AccountingMessage[]> {
    const qs = new URLSearchParams({ externalTenantId });
    const { messages } = await this.request<{ messages: AccountingMessage[] }>(`/api/v1/messages?${qs}`);
    return messages;
  }
}
