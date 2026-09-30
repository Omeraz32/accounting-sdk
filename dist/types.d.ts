export interface SyncTenantInput {
    externalTenantId: string;
    displayName: string;
    contactEmail?: string;
    contactPhone?: string;
}
export interface SendMessageInput {
    externalTenantId: string;
    authorId: string;
    topic: string;
    body: string;
    entityType?: string;
    entityId?: string;
}
export interface AccountingMessage {
    id: string;
    tenant_id: string;
    author_type: "BUSINESS" | "ACCOUNTANT";
    author_id: string;
    topic: string;
    body: string;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
    read_at: string | null;
}
export type RequestStatus = "PENDING" | "IN_PROGRESS" | "FULFILLED" | "DECLINED" | "CANCELLED";
export interface AccountingRequest {
    id: string;
    title: string;
    description: string | null;
    status: RequestStatus;
    due_date: string | null;
    created_at: string;
    updated_at: string;
}
export type MonthStatusValue = "NOT_STARTED" | "IN_PROGRESS" | "AWAITING_BUSINESS" | "SUBMITTED" | "CLOSED";
export interface MonthStatus {
    year: number;
    month: number;
    status: MonthStatusValue;
    summary: unknown;
    updated_at: string;
}
export type CallRequestStatus = "REQUESTED" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
export interface CallRequest {
    id: string;
    status: CallRequestStatus;
    proposed_times: string[] | null;
    created_at: string;
}
export interface AccountingFile {
    id: string;
    filename: string;
    content_type: string;
    size_bytes: number;
    uploaded_by_type: "BUSINESS" | "ACCOUNTANT";
    created_at: string;
}
export interface AccountingNotification {
    id: string;
    type: string;
    read_at: string | null;
    created_at: string;
}
export declare class AccountingCoreError extends Error {
    status: number;
    constructor(message: string, status: number);
}
