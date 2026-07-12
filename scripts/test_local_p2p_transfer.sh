#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${YUZU_BENCHMARK_API_PORT:-18081}"
TURN_PORT="${YUZU_BENCHMARK_TURN_PORT:-3480}"
WEB_PORT="${YUZU_BENCHMARK_WEB_PORT:-5175}"
FILE_SIZE_MB="${YUZU_BENCHMARK_FILE_SIZE_MB:-512}"
TRANSFER_TIMEOUT_SECONDS="${YUZU_BENCHMARK_TRANSFER_TIMEOUT_SECONDS:-180}"
BENCHMARK_FILE="${TMPDIR:-/tmp}/yuzu-p2p-${FILE_SIZE_MB}m.bin"
BENCHMARK_NAME="$(basename "$BENCHMARK_FILE")"
HOST_SESSION="yuzu-p2p-benchmark-host"
GUEST_SESSION="yuzu-p2p-benchmark-guest"

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing command: $1" >&2; exit 1; }
}

cleanup() {
  agent-browser --session "$HOST_SESSION" close >/dev/null 2>&1 || true
  agent-browser --session "$GUEST_SESSION" close >/dev/null 2>&1 || true
  for process_id in "${API_PID:-}" "${WEB_PID:-}"; do
    if [[ -n "$process_id" ]] && kill -0 "$process_id" >/dev/null 2>&1; then
      kill "$process_id" >/dev/null 2>&1 || true
      wait "$process_id" 2>/dev/null || true
    fi
  done
  rm -f "$BENCHMARK_FILE"
}

require_command agent-browser
require_command curl
require_command dd
trap cleanup EXIT

if [[ -d /opt/homebrew/opt/go/libexec ]]; then
  export GOROOT="/opt/homebrew/opt/go/libexec"
  export PATH="/opt/homebrew/opt/go/bin:${PATH}"
fi

(cd "$ROOT_DIR/server" && APP_PORT="$API_PORT" TURN_PORT="$TURN_PORT" TURN_PUBLIC_IP="127.0.0.1" go run .) >"${TMPDIR:-/tmp}/yuzu-p2p-api.log" 2>&1 &
API_PID=$!

cd "$ROOT_DIR"
VITE_PROXY_TARGET="http://127.0.0.1:${API_PORT}" npm run dev -- --host 127.0.0.1 --port "$WEB_PORT" >"${TMPDIR:-/tmp}/yuzu-p2p-web.log" 2>&1 &
WEB_PID=$!

until curl -fsS "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; do sleep 1; done

dd if=/dev/zero of="$BENCHMARK_FILE" bs=1m count="$FILE_SIZE_MB" status=none

agent-browser --session "$HOST_SESSION" open "http://127.0.0.1:${WEB_PORT}/" >/dev/null
sleep 1
PAIRING_LABEL="$(agent-browser --session "$HOST_SESSION" eval "document.querySelector('[aria-label*=' + JSON.stringify('pairing code') + '], [aria-label*=' + JSON.stringify('验证码') + ']')?.getAttribute('aria-label')")"
PAIRING_CODE="$(printf '%s' "$PAIRING_LABEL" | grep -oE '[0-9]{4}' | tail -1)"

if [[ -z "$PAIRING_CODE" ]]; then
  echo "unable to obtain pairing code" >&2
  exit 1
fi

agent-browser --session "$GUEST_SESSION" open "http://127.0.0.1:${WEB_PORT}/?code=${PAIRING_CODE}" >/dev/null
sleep 2

START_SECONDS=$SECONDS
agent-browser --session "$GUEST_SESSION" upload 'input[type=file]' "$BENCHMARK_FILE" >/dev/null

while true; do
  TRANSFER_STATE="$(agent-browser --session "$GUEST_SESSION" eval "(() => { const card = document.querySelector('.file-message.outgoing'); if (!card) return 'waiting'; if (card.querySelector('.transfer-status--failed')) return 'failed'; return card.querySelector('.transfer-progress, .transfer-status') ? 'transferring' : 'completed'; })()")"
  TRANSFER_STATE="${TRANSFER_STATE#\"}"
  TRANSFER_STATE="${TRANSFER_STATE%\"}"
  if [[ "$TRANSFER_STATE" == "completed" ]]; then
    break
  fi
  if [[ "$TRANSFER_STATE" == "failed" ]]; then
    echo "P2P loopback benchmark failed" >&2
    agent-browser --session "$GUEST_SESSION" get text body >&2 || true
    exit 1
  fi
  if (( SECONDS - START_SECONDS >= TRANSFER_TIMEOUT_SECONDS )); then
    echo "P2P loopback benchmark timed out after ${TRANSFER_TIMEOUT_SECONDS}s (state: ${TRANSFER_STATE})" >&2
    exit 1
  fi
  sleep 1
done

ELAPSED_SECONDS=$((SECONDS - START_SECONDS))
if (( ELAPSED_SECONDS < 1 )); then ELAPSED_SECONDS=1; fi
THROUGHPUT_MBPS=$((FILE_SIZE_MB / ELAPSED_SECONDS))

echo "P2P loopback benchmark: ${FILE_SIZE_MB} MB in ${ELAPSED_SECONDS}s (${THROUGHPUT_MBPS} MB/s)"
echo "This validates the browser-to-browser transfer path on one machine. Use two physical LAN devices to measure Wi-Fi throughput."
