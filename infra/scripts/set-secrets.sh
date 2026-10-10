#!/usr/bin/env bash
# Writes runtime secrets to Key Vault. Generated values are created locally and never printed.
# Usage: KV=<key-vault-name> RG=<resource-group> ./set-secrets.sh
set -euo pipefail
: "${KV:?set KV to the Key Vault name (deployment output keyVaultName)}"
: "${RG:?set RG to the resource group}"

put() { az keyvault secret set --vault-name "$KV" --name "$1" --value "$2" --output none && echo "set $1"; }
ask() { local v; read -r -s -p "$1: " v; echo; printf '%s' "$v"; }
exists() { az keyvault secret show --vault-name "$KV" --name "$1" --query id -o tsv >/dev/null 2>&1; }

exists totp-enc-key || put totp-enc-key "$(openssl rand -base64 32)"
exists rate-limit-salt || put rate-limit-salt "$(openssl rand -base64 24)"
exists livekit-api-key || put livekit-api-key "API$(openssl rand -hex 8)"
exists livekit-api-secret || put livekit-api-secret "$(openssl rand -base64 36 | tr -d '/+=')"
exists redis-password || put redis-password "$(openssl rand -hex 24)"

SPEECH=$(az cognitiveservices account list -g "$RG" --query "[?kind=='SpeechServices'].name | [0]" -o tsv)
put azure-speech-key "$(az cognitiveservices account keys list -g "$RG" -n "$SPEECH" --query key1 -o tsv)"

if [[ -n "${GRAPH_CERT_PEM_FILE:-}" ]]; then
  put graph-client-cert-pem "$(awk 'BEGIN{ORS="\\n"} {print}' "$GRAPH_CERT_PEM_FILE")"
else
  echo "GRAPH_CERT_PEM_FILE not set: upload graph-client-cert-pem later (PEM with private key)."
fi
put twilio-sip-username "$(ask 'Twilio termination credential username')"
put twilio-sip-password "$(ask 'Twilio termination credential password')"
for ref in ${TEAMS_WEBHOOK_REFS:-TEAMS_WEBHOOK_RECEPTION}; do
  name=$(echo "$ref" | tr '[:upper:]_' '[:lower:]-')
  put "$name" "$(ask "Teams Workflow URL for $ref")"
done
