import {
  AccountingCoreError,
  type AccountingFile,
  type AccountingMessage,
  type AccountingNotification,
  type CallRequest,
  type MonthStatus,
  type AccountingRequest,
  type SendMessageInput,
  type SyncTenantInput,
} from "./types";

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

  async listRequests(externalTenantId: string): Promise<AccountingRequest[]> {
    const qs = new URLSearchParams({ externalTenantId });
    const { requests } = await this.request<{ requests: AccountingRequest[] }>(`/api/v1/requests?${qs}`);
    return requests;
  }

  /** The business's own self-service "done" action for a request. */
  async fulfillRequest(requestId: string, externalTenantId: string): Promise<void> {
    await this.request(`/api/v1/requests/${requestId}/fulfill`, {
      method: "POST",
      body: JSON.stringify({ externalTenantId }),
    });
  }

  async listMonthStatus(externalTenantId: string): Promise<MonthStatus[]> {
    const qs = new URLSearchParams({ externalTenantId });
    const { months } = await this.request<{ months: MonthStatus[] }>(`/api/v1/month-status?${qs}`);
    return months;
  }

  async listCallRequests(externalTenantId: string): Promise<CallRequest[]> {
    const qs = new URLSearchParams({ externalTenantId });
    const { callRequests } = await this.request<{ callRequests: CallRequest[] }>(`/api/v1/call-requests?${qs}`);
    return callRequests;
  }

  async requestCall(externalTenantId: string, requestedById: string, proposedTimes?: string[]): Promise<{ id: string }> {
    return this.request("/api/v1/call-requests", {
      method: "POST",
      body: JSON.stringify({ externalTenantId, requestedById, proposedTimes }),
    });
  }

  async listFiles(externalTenantId: string): Promise<AccountingFile[]> {
    const qs = new URLSearchParams({ externalTenantId });
    const { files } = await this.request<{ files: AccountingFile[] }>(`/api/v1/files?${qs}`);
    return files;
  }

  /** Uploads a file on the business's behalf — `file` is whatever the
   *  server-side route handler received (a web-standard `File`/`Blob`). */
  async uploadFile(externalTenantId: string, uploadedById: string, file: File | Blob, filename?: string): Promise<{ id: string; filename: string }> {
    const form = new FormData();
    form.set("externalTenantId", externalTenantId);
    form.set("uploadedById", uploadedById);
    form.set("file", file, filename);
    const res = await withTimeout(
      fetch(`${this.baseUrl}/api/v1/files`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}` },
        body: form,
      }),
      this.timeoutMs,
      "Accounting Core request timed out: /api/v1/files"
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AccountingCoreError(body.error ?? `Accounting Core request failed (${res.status})`, res.status);
    }
    return res.json();
  }

  /** Returns a readable stream of the file's bytes for the caller to pipe
   *  into its own authenticated download response - the raw Blob URL never
   *  needs to leave Core. */
  async downloadFile(fileId: string, externalTenantId: string): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string; contentDisposition: string } | null> {
    const qs = new URLSearchParams({ externalTenantId });
    const res = await fetch(`${this.baseUrl}/api/v1/files/${fileId}/download?${qs}`, {
      headers: { authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok || !res.body) return null;
    return {
      stream: res.body,
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
      contentDisposition: res.headers.get("content-disposition") ?? "attachment",
    };
  }

  async listNotifications(externalTenantId: string): Promise<AccountingNotification[]> {
    const qs = new URLSearchParams({ externalTenantId });
    const { notifications } = await this.request<{ notifications: AccountingNotification[] }>(`/api/v1/notifications?${qs}`);
    return notifications;
  }

  async markNotificationsRead(externalTenantId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.request("/api/v1/notifications/read", { method: "POST", body: JSON.stringify({ externalTenantId, ids }) });
  }
}
