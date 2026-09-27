import { type AccountingMessage, type SendMessageInput, type SyncTenantInput } from "./types";
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
export declare class AccountingClient {
    private baseUrl;
    private apiKey;
    private timeoutMs;
    constructor(options: AccountingClientOptions);
    private request;
    /** Call whenever the business's profile is created or edited. Idempotent. */
    syncTenant(input: SyncTenantInput): Promise<{
        tenantId: string;
    }>;
    /** Whether this business has the Accountant Service feature enabled. Use this
     *  to decide whether to render the "רואה החשבון שלי" area at all. */
    isAccountantServiceEnabled(externalTenantId: string): Promise<boolean>;
    sendMessage(input: SendMessageInput): Promise<{
        id: string;
        createdAt: string;
    }>;
    listMessages(externalTenantId: string): Promise<AccountingMessage[]>;
}
