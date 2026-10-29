#!/usr/bin/env bash
#
# Expose the local API over HTTPS so Paystack can deliver real webhooks to your machine.
#
# Why you want this even though /payment/verify exists:
#   verify-on-return proves the happy path. It does NOT exercise the webhook — signature
#   verification, Paystack's retry behaviour, or what happens when the customer closes the app
#   mid-payment and only the webhook ever arrives. Those are exactly the paths that fail in
#   production, so test them here.
#
# Uses cloudflared. It needs no account for a quick tunnel and issues a real HTTPS hostname.
#
#   brew install cloudflared
#   bash scripts/tunnel_webhook.sh
#
# Then, in the Paystack dashboard (Settings -> API Keys & Webhooks), set the TEST webhook URL to:
#
#   https://<hostname-printed-below>/payment/webhook/paystack
#
# Leave this running while you test. The hostname changes every restart, so re-paste it each
# time — or use a named tunnel if that becomes annoying.
#
set -euo pipefail

PORT="${1:-8000}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed."
  echo
  echo "  brew install cloudflared"
  echo
  echo "Alternative: ngrok (needs a free account)"
  echo "  brew install ngrok && ngrok config add-authtoken <token> && ngrok http ${PORT}"
  exit 1
fi

if ! curl -sf -m 3 "http://localhost:${PORT}/health" >/dev/null; then
  echo "Nothing is answering on http://localhost:${PORT}/health."
  echo "Start the API first:  uv run uvicorn main:app --host 0.0.0.0 --port ${PORT}"
  exit 1
fi

cat <<'BANNER'
────────────────────────────────────────────────────────────────────────
Starting a Cloudflare quick tunnel.

Watch for the https://<something>.trycloudflare.com line below, then set
this in Paystack (Settings -> API Keys & Webhooks -> Test Webhook URL):

    https://<that-host>/payment/webhook/paystack

Keep this process running for as long as you are testing.
────────────────────────────────────────────────────────────────────────
BANNER

exec cloudflared tunnel --url "http://localhost:${PORT}"
