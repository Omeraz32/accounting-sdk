import { AccountingCoreError } from "./types";
const ACCOUNTANT_FEATURE = "accountant_service";
async function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    }
    finally {
        clearTimeout(timer);
    }
}
export class AccountingClient {
    baseUrl;
    apiKey;
    timeoutMs;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.apiKey = options.apiKey;
        this.timeoutMs = options.timeoutMs ?? 10_000;
    }
    async request(path, init = {}) {
        const res = await withTimeout(fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${this.apiKey}`,
                ...init.headers,
            },
        }), this.timeoutMs, `Accounting Core request timed out: ${path}`);
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new AccountingCoreError(body.error ?? `Accounting Core request failed (${res.status})`, res.status);
        }
        return res.json();
    }
    /** Call whenever the business's profile is created or edited. Idempotent. */
    async syncTenant(input) {
        return this.request("/api/v1/tenants/sync", { method: "POST", body: JSON.stringify(input) });
    }
    /** Whether this business has the Accountant Service feature enabled. Use this
     *  to decide whether to render the "רואה החשבון שלי" area at all. */
    async isAccountantServiceEnabled(externalTenantId) {
        const qs = new URLSearchParams({ externalTenantId, feature: ACCOUNTANT_FEATURE });
        const { entitled } = await this.request(`/api/v1/entitlements/check?${qs}`);
        return entitled;
    }
    async sendMessage(input) {
        return this.request("/api/v1/messages", { method: "POST", body: JSON.stringify(input) });
    }
    async listMessages(externalTenantId) {
        const qs = new URLSearchParams({ externalTenantId });
        const { messages } = await this.request(`/api/v1/messages?${qs}`);
        return messages;
    }
}
