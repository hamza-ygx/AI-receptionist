# Teams notifications (Workflows)

Office 365 connectors ("incoming webhooks") were retired in 2026. Notifications use **Teams Workflows (Power Automate)** instead: **"When a Teams webhook request is received"** → **"Post card in a chat or channel"**.

## 1. Create one workflow per destination

You need one for the reception channel (required) and one per consultant, if they should get their own card.

1. In Teams, open the channel → **⋯ → Workflows → "Post to a channel when a webhook request is received"**. You can also do this in Power Automate with the trigger *When a Teams webhook request is received*.
2. Choose the team and channel. Use standard channels; support for private channels is not guaranteed.
3. Set **Who can trigger the flow** to **Specific users in my tenant** and add the **object ID of `func-voice`'s managed identity**:
   - `az functionapp identity show -g <rg> -n func-rkjh-ai-prod-voice --query principalId -o tsv`
   - Add `func-dash`'s identity too, if you later post from the dashboard.
4. Save and copy the HTTP POST URL.
5. Add a **co-owner** to the flow (e.g. IT). Flows belong to a user and stop when that user leaves.

With this setting `func-voice` sends an Entra token (`TEAMS_FLOW_AUTH=entra`, audience `https://service.flow.microsoft.com/`), so the URL alone is not enough to post. If you choose *Anyone*, set `TEAMS_FLOW_AUTH=none`; the URL's SAS signature is then the only protection.

## 2. Store the URL

The URL is a secret. For reception:

```bash
az keyvault secret set --vault-name <kv> --name teams-webhook-reception --value '<url>'
```

For a consultant:

1. Pick a ref name, e.g. `TEAMS_WEBHOOK_ANNA`.
2. Store the secret `teams-webhook-anna`.
3. Add `TEAMS_WEBHOOK_ANNA` to `teamsWebhookRefs` in the Bicep params and set `teamsWebhookRef: TEAMS_WEBHOOK_ANNA` in `config/staff.yaml`.
4. Redeploy the infrastructure, then run the seed.

The API only posts to hosts under `*.logic.azure.com`, `*.powerplatform.com` or `*.azure-api.net`.

## 3. What gets posted

Adaptive Card 1.5 (`application/vnd.microsoft.card.adaptive`):

- **Message**, posted after the call ends so the Swedish summary is included; high urgency is posted immediately:
  - caller, company, phone, language, reason, urgency, outcome, summary
  - an **Öppna samtal** button that links to the dashboard
- **Booking**: consultant, time, meeting type, caller, company, phone, e-mail, topic.
- **Routing**: a consultant-specific message or booking goes to that consultant's workflow if one is configured, otherwise to reception. If the consultant's post fails, it falls back to reception.
- **Retries and backlog**: 3 attempts with backoff. Messages still unposted after 10 minutes are swept by a 5-minute timer. The message always stays in the DB and the dashboard.
