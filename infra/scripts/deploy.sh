#!/usr/bin/env bash
# End-to-end deployment. Each stage asks for confirmation. Requires: az (logged in), node 22, zip, psql for pg-roles.
# Usage: RG=rg-rkjh-ai-prod PARAMS=infra/params/prod.bicepparam ./infra/scripts/deploy.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RG="${RG:?set RG}"
PARAMS="${PARAMS:-$ROOT/infra/params/prod.bicepparam}"
LOCATION="${LOCATION:-swedencentral}"
confirm() { read -r -p "$1 [y/N] " a; [[ "$a" == "y" || "$a" == "Y" ]]; }

if confirm "1/5 Deploy infrastructure to resource group $RG ($LOCATION)?"; then
  az group create -n "$RG" -l "$LOCATION" --tags app=rkjh-ai-receptionist --output none
  az deployment group create -g "$RG" -n main -f "$ROOT/infra/main.bicep" -p "$PARAMS" --output none
fi
out() { az deployment group show -g "$RG" -n main --query "properties.outputs.$1.value" -o tsv; }
VOICE=$(out voiceFunctionName); DASH=$(out dashFunctionName); KV=$(out keyVaultName)

if confirm "2/5 Write secrets to Key Vault $KV?"; then
  KV="$KV" "$ROOT/infra/scripts/set-secrets.sh"
fi

if confirm "3/5 Build and deploy the API to $VOICE and $DASH?"; then
  "$ROOT/infra/scripts/package-api.sh"
  az functionapp deploy -g "$RG" -n "$VOICE" --src-path "$ROOT/dist/api.zip" --type zip --output none
  az functionapp deploy -g "$RG" -n "$DASH" --src-path "$ROOT/dist/api.zip" --type zip --output none
fi

echo "Before step 4: run infra/scripts/pg-roles.sql once (see header) so the function identities can log in."
if confirm "4/5 Run DB migrations + seed via $VOICE admin endpoints?"; then
  KEY=$(az functionapp keys list -g "$RG" -n "$VOICE" --query masterKey -o tsv)
  HOST=$(out voiceHostname)
  curl -fsS -X POST "https://$HOST/api/admin/migrate" -H "x-functions-key: $KEY"; echo
  curl -fsS -X POST "https://$HOST/api/admin/seed" -H "x-functions-key: $KEY"; echo
fi

if confirm "5/5 Build and deploy the dashboard to Static Web Apps?"; then
  SWA=$(az staticwebapp list -g "$RG" --query "[0].name" -o tsv)
  TOKEN=$(az staticwebapp secrets list -g "$RG" -n "$SWA" --query properties.apiKey -o tsv)
  (cd "$ROOT" && npm run build -w web && cp web/staticwebapp.config.json web/dist/)
  npx --yes @azure/static-web-apps-cli@2 deploy "$ROOT/web/dist" --deployment-token "$TOKEN" --env production
fi
echo "Next: npm run vapi:sync -- --env prod (dry run), then --apply; set VAPI_SQUAD_ID and redeploy infra params."
