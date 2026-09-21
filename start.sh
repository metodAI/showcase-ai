#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Starting ngrok..."

if ! curl -sf http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; then
    ngrok http 5678 >/tmp/showcase-ai-ngrok.log 2>&1 &
    echo "==> Waiting for ngrok..."

    for i in {1..30}; do
        if curl -sf http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

NGROK_URL="$(
    curl -sf http://127.0.0.1:4040/api/tunnels \
    | grep -o '"public_url":"https://[^"]*"' \
    | head -1 \
    | cut -d'"' -f4
)"

if [[ -z "${NGROK_URL}" ]]; then
    echo "ERROR: Could not determine ngrok public URL."
    exit 1
fi

echo "==> ngrok URL: ${NGROK_URL}"
echo "==> Starting n8n..."

cd "${PROJECT_DIR}"

WEBHOOK_URL="${NGROK_URL}" docker compose up -d

echo "==> Showcase AI is running."
echo "==> Webhook URL: ${NGROK_URL}"
