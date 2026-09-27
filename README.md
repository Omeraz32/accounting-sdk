# @torli-family/accounting-sdk

Shared client for torli-platform, barber, pulsefit, driver and therapists-hub to talk to the central [Accounting Core](../accounting-core). Install as a git dependency (no private registry needed):

```json
"dependencies": {
  "@torli-family/accounting-sdk": "git+https://github.com/<you>/accounting-sdk.git#v0.1.0"
}
```

## Usage (server-only — never import this from a "use client" file)

```ts
import { AccountingClient } from "@torli-family/accounting-sdk";

const accounting = new AccountingClient({
  baseUrl: process.env.ACCOUNTING_CORE_URL!,
  apiKey: process.env.ACCOUNTING_CORE_API_KEY!, // minted by accounting-core/scripts/seed.ts
});

await accounting.syncTenant({ externalTenantId: practitionerId, displayName: business.name });
const enabled = await accounting.isAccountantServiceEnabled(practitionerId);
```

The client never sends an "app id" anywhere — Core derives which app is calling purely from which API key hash matches, so one app can never impersonate another's identity even by mistake.
