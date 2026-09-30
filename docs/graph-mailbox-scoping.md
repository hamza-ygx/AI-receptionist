# Microsoft Graph: calendar access limited to consultant mailboxes

The receptionist reads free/busy (`getSchedule`) and creates events in consultants' calendars. It uses an **app registration with the application permission `Calendars.ReadWrite`**. That permission is scoped with **Exchange Online RBAC for Applications** so the app can touch **only** the consultants' mailboxes.

> Application Access Policies (`New-ApplicationAccessPolicy`) are now marked *legacy* by Microsoft. Use RBAC for Applications for new setups.

## 1. Mail-enabled security group

In the Exchange admin center, create a mail-enabled security group, e.g. `sg-ai-receptionist-calendars@rkjh.se`. Add every consultant who can be booked or whose calendar the receptionist should read. `MemberOfGroup` scoping only counts **direct** members, so don't nest groups.

## 2. App registration

1. In Entra ID → App registrations → New: `rkjh-ai-receptionist-graph`, single tenant.
2. Under Certificates & secrets, upload a **certificate**. Create one with:
   ```bash
   openssl req -x509 -newkey rsa:3072 -sha256 -days 730 -nodes \
     -keyout graph.key -out graph.crt -subj "/CN=rkjh-ai-receptionist-graph"
   cat graph.crt graph.key > graph-with-key.pem
   ```
   - Upload `graph.crt`.
   - Store `graph-with-key.pem` in Key Vault via `GRAPH_CERT_PEM_FILE=graph-with-key.pem ./infra/scripts/set-secrets.sh`.
   - Delete the local key files afterwards.
   - A client secret (`GRAPH_CLIENT_SECRET`) is supported **for local dev only**.
3. Note the **Application (client) ID**, which goes into `graphClientId`, and the **Enterprise application Object ID** from Enterprise applications → the app → Object ID.
4. **Do not** grant `Calendars.ReadWrite` admin consent under *API permissions*. Entra consent and Exchange RBAC grants are a *union*: a tenant-wide Entra grant would make the mailbox scope below meaningless. If you already granted it, remove it.

## 3. Exchange RBAC for Applications

Run in Exchange Online PowerShell as an Exchange admin:

```powershell
Connect-ExchangeOnline

# Link the Entra service principal into Exchange
New-ServicePrincipal -AppId <APP_CLIENT_ID> -ObjectId <ENTERPRISE_APP_OBJECT_ID> -DisplayName "rkjh-ai-receptionist-graph"

# Scope = members of the calendar group
$dn = (Get-DistributionGroup sg-ai-receptionist-calendars@rkjh.se).DistinguishedName
New-ManagementScope -Name "AI-Receptionist-Calendars" -RecipientRestrictionFilter "MemberOfGroup -eq '$dn'"

# Grant Calendars.ReadWrite only inside that scope
New-ManagementRoleAssignment -App <APP_CLIENT_ID> -Role "Application Calendars.ReadWrite" -CustomResourceScope "AI-Receptionist-Calendars"
```

Changes can take between 30 minutes and about 2 hours to propagate.

## 4. Verify

```powershell
Test-ServicePrincipalAuthorization -Identity <APP_CLIENT_ID> -Resource anna@rkjh.se   # InScope : True
Test-ServicePrincipalAuthorization -Identity <APP_CLIENT_ID> -Resource vd@rkjh.se     # a non-member → InScope : False
```

Also test from the API: `check_availability` for a consultant should return slots, and a non-member mailbox should fail with *ErrorAccessDenied*.

## 5. Teams links on booked meetings

`book_meeting` creates events with `isOnlineMeeting: true` and `onlineMeetingProvider: teamsForBusiness` for Teams meetings.

- The consultant needs a Teams licence, and a meeting policy that allows Outlook add-in / online meetings.
- Microsoft doesn't explicitly document app-only Teams-link creation. Test it on one real consultant mailbox before go-live. If no join URL comes back, the fallback is to put a personal static Teams meeting link in `config/staff.yaml` (small code change).
- If the caller gave an e-mail address, they are added as an attendee, so Exchange sends the invitation from the consultant's mailbox.

## Checklist

- [ ] Group created, and all consultants are direct members
- [ ] App registration uses a certificate, not a secret, in production
- [ ] **No** tenant-wide `Calendars.ReadWrite` consent in Entra
- [ ] `New-ServicePrincipal`, `New-ManagementScope` and `New-ManagementRoleAssignment` done
- [ ] `Test-ServicePrincipalAuthorization` gives InScope True for members and False for others
- [ ] Every consultant's `upn` in `config/staff.yaml` matches their mailbox
