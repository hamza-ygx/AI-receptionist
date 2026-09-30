#!/usr/bin/env bash
# Writes the runtime secrets to Key Vault. Generated values are created locally and never printed.
# Usage: KV=<key-vault-name> ./set-secrets.sh
set -euo pipefail
: "${KV:?set KV to the Key Vault name (deployment output keyVaultName)}"

put() { az keyvault secret set --vault-name "$KV" --name "$1" --value "$2" --output none && echo "set $1"; }
ask() { local v; read -r -s -p "$1: " v; echo; printf '%s' "$v"; }
exists() { az keyvault secret show --vault-name "$KV" --name "$1" --query id -o tsv >/dev/null 2>&1; }

exists totp-enc-key || put totp-enc-key "$(openssl rand -base64 32)"
exists rate-limit-salt || put rate-limit-salt "$(openssl rand -base64 24)"
exists vapi-webhook-secret || put vapi-webhook-secret "$(openssl rand -hex 32)"

put vapi-api-key "$(ask 'Vapi private API key (EU org)')"
if [[ -n "${GRAPH_CERT_PEM_FILE:-}" ]]; then
  put graph-client-cert-pem "$(awk 'BEGIN{ORS="\\n"} {print}' "$GRAPH_CERT_PEM_FILE")"
else
  echo "GRAPH_CERT_PEM_FILE not set: upload graph-client-cert-pem later (PEM with private key)."
fi
for ref in ${TEAMS_WEBHOOK_REFS:-TEAMS_WEBHOOK_RECEPTION}; do
  name=$(echo "$ref" | tr '[:upper:]_' '[:lower:]-')
  put "$name" "$(ask "Teams Workflow URL for $ref")"
done
echo "Done. Copy vapi-webhook-secret into the Vapi HMAC credential:"
echo "  az keyvault secret show --vault-name $KV --name vapi-webhook-secret --query value -o tsv"
