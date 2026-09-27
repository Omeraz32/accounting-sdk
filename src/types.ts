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

export class AccountingCoreError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "AccountingCoreError";
  }
}
