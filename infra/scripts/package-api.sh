#!/usr/bin/env bash
# Builds a deployable zip for Azure Functions (Flex Consumption, Linux x64) at ./dist/api.zip.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/dist"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

(cd "$ROOT" && npm ci && npm run build -w api)
cp -r "$ROOT/api/dist" "$ROOT/api/migrations" "$ROOT/api/config" "$ROOT/api/host.json" "$ROOT/api/package.json" "$STAGE/"
(cd "$STAGE" && npm install --omit=dev --no-audit --no-fund --ignore-scripts=false)
mkdir -p "$OUT"
(cd "$STAGE" && zip -qr "$OUT/api.zip" .)
echo "Built $OUT/api.zip"
