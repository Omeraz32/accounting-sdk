import { AccountingCoreError, } from "./types";
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
    async listRequests(externalTenantId) {
        const qs = new URLSearchParams({ externalTenantId });
        const { requests } = await this.request(`/api/v1/requests?${qs}`);
        return requests;
    }
    /** The business's own self-service "done" action for a request. */
    async fulfillRequest(requestId, externalTenantId) {
        await this.request(`/api/v1/requests/${requestId}/fulfill`, {
            method: "POST",
            body: JSON.stringify({ externalTenantId }),
        });
    }
    async listMonthStatus(externalTenantId) {
        const qs = new URLSearchParams({ externalTenantId });
        const { months } = await this.request(`/api/v1/month-status?${qs}`);
        return months;
    }
    async listCallRequests(externalTenantId) {
        const qs = new URLSearchParams({ externalTenantId });
        const { callRequests } = await this.request(`/api/v1/call-requests?${qs}`);
        return callRequests;
    }
    async requestCall(externalTenantId, requestedById, proposedTimes) {
        return this.request("/api/v1/call-requests", {
            method: "POST",
            body: JSON.stringify({ externalTenantId, requestedById, proposedTimes }),
        });
    }
    async listFiles(externalTenantId) {
        const qs = new URLSearchParams({ externalTenantId });
        const { files } = await this.request(`/api/v1/files?${qs}`);
        return files;
    }
    /** Uploads a file on the business's behalf — `file` is whatever the
     *  server-side route handler received (a web-standard `File`/`Blob`). */
    async uploadFile(externalTenantId, uploadedById, file, filename) {
        const form = new FormData();
        form.set("externalTenantId", externalTenantId);
        form.set("uploadedById", uploadedById);
        form.set("file", file, filename);
        const res = await withTimeout(fetch(`${this.baseUrl}/api/v1/files`, {
            method: "POST",
            headers: { authorization: `Bearer ${this.apiKey}` },
            body: form,
        }), this.timeoutMs, "Accounting Core request timed out: /api/v1/files");
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new AccountingCoreError(body.error ?? `Accounting Core request failed (${res.status})`, res.status);
        }
        return res.json();
    }
    /** Returns a readable stream of the file's bytes for the caller to pipe
     *  into its own authenticated download response - the raw Blob URL never
     *  needs to leave Core. */
    async downloadFile(fileId, externalTenantId) {
        const qs = new URLSearchParams({ externalTenantId });
        const res = await fetch(`${this.baseUrl}/api/v1/files/${fileId}/download?${qs}`, {
            headers: { authorization: `Bearer ${this.apiKey}` },
        });
        if (!res.ok || !res.body)
            return null;
        return {
            stream: res.body,
            contentType: res.headers.get("content-type") ?? "application/octet-stream",
            contentDisposition: res.headers.get("content-disposition") ?? "attachment",
        };
    }
    async listNotifications(externalTenantId) {
        const qs = new URLSearchParams({ externalTenantId });
        const { notifications } = await this.request(`/api/v1/notifications?${qs}`);
        return notifications;
    }
    async markNotificationsRead(externalTenantId, ids) {
        if (ids.length === 0)
            return;
        await this.request("/api/v1/notifications/read", { method: "POST", body: JSON.stringify({ externalTenantId, ids }) });
    }
}
