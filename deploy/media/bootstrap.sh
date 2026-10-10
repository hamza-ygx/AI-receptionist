#!/usr/bin/env bash
# Runs on the media VM (as root). Pulls secrets from Key Vault with the VM's managed identity,
# renders configs and (re)starts the stack. Idempotent: run again after any secret or image change.
# Usage: KV=<key-vault-name> ACR=<registry-name> AGENT_TAG=<tag> ./bootstrap.sh
set -euo pipefail
: "${KV:?}" "${ACR:?}" "${AGENT_TAG:?}"
HERE="$(cd "$(dirname "$0")" && pwd)"
install -d -m 700 /etc/rkjh

az login --identity --output none
secret() { az keyvault secret show --vault-name "$KV" --name "$1" --query value -o tsv; }
optional_secret() { az keyvault secret show --vault-name "$KV" --name "$1" --query value -o tsv 2>/dev/null || true; }

PRIVATE_IP=$(curl -s -H Metadata:true "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/privateIpAddress?api-version=2021-02-01&format=text")
PUBLIC_IP=$(curl -s -H Metadata:true "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text")

umask 077
cat > /etc/rkjh/media.env <<ENV
LIVEKIT_API_KEY=$(secret livekit-api-key)
LIVEKIT_API_SECRET=$(secret livekit-api-secret)
REDIS_PASSWORD=$(secret redis-password)
AGENT_IMAGE=${ACR}.azurecr.io/rkjh-agent:${AGENT_TAG}
PRIVATE_IP=${PRIVATE_IP}
PUBLIC_IP=${PUBLIC_IP}
ENV

cat > /etc/rkjh/agent.env <<ENV
$(cat "$HERE/agent.env.static")
AZURE_SPEECH_KEY=$(secret azure-speech-key)
RATE_LIMIT_SALT=$(secret rate-limit-salt)
TWILIO_SIP_USERNAME=$(optional_secret twilio-sip-username)
TWILIO_SIP_PASSWORD=$(optional_secret twilio-sip-password)
$(for ref in $(sed -n 's/^TEAMS_WEBHOOK_REFS=//p' "$HERE/agent.env.static"); do
    echo "${ref}=$(secret "$(echo "$ref" | tr '[:upper:]_' '[:lower:]-')")"
  done)
GRAPH_CLIENT_CERT_PEM=$(secret graph-client-cert-pem)
ENV

set -a; . /etc/rkjh/media.env; set +a
envsubst < "$HERE/livekit.yaml.tmpl" > "$HERE/livekit.yaml"
envsubst < "$HERE/sip.yaml.tmpl" > "$HERE/sip.yaml"
chmod 600 "$HERE/sip.yaml"

az acr login --name "$ACR" --expose-token --output tsv --query accessToken | docker login "${ACR}.azurecr.io" -u 00000000-0000-0000-0000-000000000000 --password-stdin
cd "$HERE"
docker compose --env-file /etc/rkjh/media.env pull
docker compose --env-file /etc/rkjh/media.env up -d --remove-orphans
docker compose --env-file /etc/rkjh/media.env ps
