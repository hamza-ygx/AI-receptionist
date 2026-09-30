# Azure setup (Sweden Central)

Everything runs in one resource group in **Sweden Central**. The only exception is Static Web Apps, which has no Sweden Central region: its resource sits in West Europe and its static content is served globally. See [gdpr-notes.md](gdpr-notes.md).

## 0. Prerequisites

- An Azure subscription with an Owner (or Contributor + User Access Administrator) role on the target resource group.
- The `az` CLI (≥ 2.70) logged in to the RKJH tenant: `az login --tenant <tenant-id>`.
- Node 22, `zip` and `psql`.
- An Entra security group for Postgres admins, e.g. `sg-rkjh-ai-dbadmins`, with you as a member.
- Quota for Azure OpenAI **gpt-5.4-mini (Data Zone Standard)** and **text-embedding-3-small (Standard)** in Sweden Central. Check this in Foundry → Quotas.
  - The Microsoft model matrix is inconsistent on Data Zone availability for gpt-5.4-mini in swedencentral. If the deployment fails, set `chatDeploymentSku = 'Standard'` and the chat model to `gpt-5.1` (regional). Then set `VAPI_LLM_MODEL=gpt-5.1:swedencentral`.

## 1. Parameters

Edit `infra/params/prod.bicepparam`:

| Param | Value |
|---|---|
| `alertEmail` | Mailbox for alerts (errors, and unconfirmed Vapi deletions) |
| `pgAdminGroupObjectId` / `pgAdminGroupName` | The Entra group above |
| `dashboardBaseUrl` | Custom domain, e.g. `https://receptionist.rkjh.se`. Leave empty to use the SWA default hostname |
| `acsCustomDomain` | e.g. `rkjh.se` to send from your own domain. Leave empty for an Azure-managed domain |
| `vapiSquadId` | Fill in after the first `vapi:sync --apply`, then redeploy |
| `twilioNumberE164` | The imported Twilio number (added to the loop-protection list) |
| `graphClientId` | See [graph-mailbox-scoping.md](graph-mailbox-scoping.md) |
| `teamsWebhookRefs` | One entry per `teamsWebhookRef` used in `config/staff.yaml`, plus `TEAMS_WEBHOOK_RECEPTION` |

## 2. Deploy

```bash
RG=rg-rkjh-ai-prod ./infra/scripts/deploy.sh
```

The script asks before each stage.

1. **Infrastructure** (`infra/main.bicep`) creates:
   - VNet with a delegated subnet per Function App, a Postgres subnet and an admin subnet
   - PostgreSQL 16 Flexible Server with private access, Entra-only auth, TLS 1.3 minimum, and pgvector/pg_trgm/citext/pgcrypto allow-listed
   - Two Flex Consumption Function Apps with system-assigned identity. `func-voice` keeps 1 instance always ready.
   - Storage with shared-key auth disabled, and a `kb-scrape` queue
   - Key Vault (RBAC, purge protection)
   - Azure OpenAI with `gpt-5.4-mini` and `text-embedding-3-small`
   - Speech
   - ACS Email (data location Europe)
   - Static Web App (Standard) with `func-dash` as linked backend
   - Log Analytics / App Insights with 30-day retention, plus alerts
2. **Secrets.** `set-secrets.sh` generates `totp-enc-key`, `rate-limit-salt` and `vapi-webhook-secret`. It then prompts for:
   - the Vapi API key
   - the Teams Workflow URLs
   - the Graph certificate, via `GRAPH_CERT_PEM_FILE=path/to/cert-with-key.pem`
3. **API.** `package-api.sh` builds one zip, which is deployed to both apps. `APP_ROLE` selects which functions register in each app.
4. **Database.** First run `infra/scripts/pg-roles.sql` **once**, from a host inside the VNet. Azure Cloud Shell with VNet integration works, or a small VM in `snet-admin`. The header of the SQL file has the exact `psql` command. The script then calls `POST /api/admin/migrate` and `/api/admin/seed` on `func-voice`, using the Functions master key.
5. **Dashboard.** Builds `web/` and deploys it with the SWA CLI.

## 3. After the first deploy

- **First admin.** From a host in the VNet (same as for `pg-roles.sql`), run `npm run user:create-admin -w api -- you@rkjh.se "Namn Efternamn"` with `PGHOST`, `PGUSER=<your Entra admin>` and `PG_ENTRA_AUTH=true`. Open the printed link within 24 h, set a password, then enrol TOTP.
- **Custom domain for the dashboard** (optional): SWA → Custom domains → add `receptionist.rkjh.se` (CNAME). Then set `dashboardBaseUrl` and redeploy, because the CSRF origin check and email links use this URL.
- **ACS custom domain** (optional):
  1. Email Communication Service → Domains → `rkjh.se`.
  2. Add the TXT, SPF (`include:spf.protection.outlook.com`) and two DKIM CNAME records.
  3. Wait until all four show *Verified*.
  4. Communication Service → Email → Connect domain.
  5. Set `ACS_SENDER`, e.g. `DoNotReply@rkjh.se`.
- **Vapi.** Follow [vapi.md](vapi.md). The webhook URL is `https://<voiceHostname>/api/vapi/events`.
- **Knowledge base.** Dashboard → Kunskapsbas → *Läs in webbplatsen igen*. Alternatively wait for Monday's 01:00 UTC timer. The page then shows whether the corpus is injected into the prompt or searched.
- **Optional hardening:** restrict inbound access on `func-voice` to Vapi's EU egress IPs (see [vapi.md](vapi.md)) with Access Restrictions. Do **not** add inbound restrictions to `func-dash`, because SWA linked backends don't support them.

## Operations

| Task | How |
|---|---|
| Change staff, hours or holidays | Edit `config/*.yaml` → redeploy the API → `POST /api/admin/seed` |
| Change prompts | Edit `vapi/prompts/*/system.vN.md` (bump `PROMPT_VERSION` in `vapi/src/defs/assistants.ts`) → `npm run vapi:sync -- --env prod --apply` |
| Switch the LLM | Set `VAPI_LLM_MODEL` (sync + Function setting), and deploy the model in Azure OpenAI with the **same deployment name** |
| GDPR erasure for one call | Dashboard → call → *Radera samtal (GDPR)* (admin). This also queues the Vapi deletion. |
| Logs | App Insights. Phone numbers, e-mails and transcripts are masked or never logged. |
| Rotate the Vapi webhook secret | New KV secret version → update the Vapi HMAC credential → restart `func-voice` |
