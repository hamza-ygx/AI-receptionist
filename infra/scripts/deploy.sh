#!/usr/bin/env bash
# End-to-end deployment. Each stage asks for confirmation. Requires: az (logged in), node 22, zip.
# Usage: RG=rg-rkjh-ai-prod PARAMS=infra/params/prod.bicepparam ./infra/scripts/deploy.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RG="${RG:?set RG}"
PARAMS="${PARAMS:-$ROOT/infra/params/prod.bicepparam}"
LOCATION="${LOCATION:-swedencentral}"
confirm() { read -r -p "$1 [y/N] " a; [[ "$a" == "y" || "$a" == "Y" ]]; }

if confirm "1/7 Deploy infrastructure to resource group $RG ($LOCATION)?"; then
  az group create -n "$RG" -l "$LOCATION" --tags app=rkjh-ai-receptionist --output none
  az deployment group create -g "$RG" -n main -f "$ROOT/infra/main.bicep" -p "$PARAMS" --output none
fi
out() { az deployment group show -g "$RG" -n main --query "properties.outputs.$1.value" -o tsv; }
JOBS=$(out jobsFunctionName); DASH=$(out dashFunctionName); KV=$(out keyVaultName); VM=$(out mediaVmName); ACR=$(out acrName)

if confirm "2/7 Write secrets to Key Vault $KV?"; then
  KV="$KV" RG="$RG" "$ROOT/infra/scripts/set-secrets.sh"
fi

if confirm "3/7 Build and deploy the API to $JOBS and $DASH?"; then
  "$ROOT/infra/scripts/package-api.sh"
  az functionapp deploy -g "$RG" -n "$JOBS" --src-path "$ROOT/dist/api.zip" --type zip --output none
  az functionapp deploy -g "$RG" -n "$DASH" --src-path "$ROOT/dist/api.zip" --type zip --output none
fi

echo "Before step 4: run infra/scripts/pg-roles.sql once (see header) so the identities can log in."
if confirm "4/7 Run DB migrations + seed via $JOBS admin endpoints?"; then
  KEY=$(az functionapp keys list -g "$RG" -n "$JOBS" --query masterKey -o tsv)
  HOST=$(out jobsHostname)
  curl -fsS -X POST "https://$HOST/api/admin/migrate" -H "x-functions-key: $KEY"; echo
  curl -fsS -X POST "https://$HOST/api/admin/seed" -H "x-functions-key: $KEY"; echo
fi

TAG="${AGENT_TAG:-$(git -C "$ROOT" rev-parse --short HEAD)}"
if confirm "5/7 Build the agent image in $ACR (tag $TAG)?"; then
  az acr build -r "$ACR" -t "rkjh-agent:$TAG" -f "$ROOT/agent/Dockerfile" "$ROOT"
fi

if confirm "6/7 Install/refresh the media stack on $VM?"; then
  [[ -f "$ROOT/deploy/media/agent.env.static" ]] || { echo "Create deploy/media/agent.env.static from the .example first"; exit 1; }
  BUNDLE=$(tar -C "$ROOT/deploy/media" -czf - docker-compose.yml livekit.yaml.tmpl sip.yaml.tmpl bootstrap.sh agent.env.static | base64 -w0)
  az vm run-command invoke -g "$RG" -n "$VM" --command-id RunShellScript --scripts \
    "set -e; mkdir -p /opt/rkjh/media; echo '$BUNDLE' | base64 -d | tar -C /opt/rkjh/media -xzf -; cd /opt/rkjh/media; KV=$KV ACR=$ACR AGENT_TAG=$TAG ./bootstrap.sh" \
    --query "value[0].message" -o tsv
fi

if confirm "7/7 Provision LiveKit SIP trunks + dispatch rule on $VM (first install only)?"; then
  az vm run-command invoke -g "$RG" -n "$VM" --command-id RunShellScript --scripts \
    "cd /opt/rkjh/media && docker compose --env-file /etc/rkjh/media.env exec -T agent node agent/dist/scripts/provisionSip.js --apply" \
    --query "value[0].message" -o tsv
  echo "Copy LIVEKIT_SIP_OUTBOUND_TRUNK_ID into deploy/media/agent.env.static and re-run step 6."
fi

if confirm "Build and deploy the dashboard to Static Web Apps?"; then
  SWA=$(az staticwebapp list -g "$RG" --query "[0].name" -o tsv)
  TOKEN=$(az staticwebapp secrets list -g "$RG" -n "$SWA" --query properties.apiKey -o tsv)
  (cd "$ROOT" && npm run build -w web && cp web/staticwebapp.config.json web/dist/)
  npx --yes @azure/static-web-apps-cli@2 deploy "$ROOT/web/dist" --deployment-token "$TOKEN" --env production
fi
echo "Media VM public IP: $(out mediaPublicIp) → set as the Twilio trunk origination URI sip:<ip>:5060;transport=udp"
