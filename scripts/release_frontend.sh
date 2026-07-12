#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_HOST="root@noondot.com"
REMOTE_FRONTEND_DIR="/opt/1panel/apps/openresty/openresty/www/sites/kc.noondot.com/index"

cd "${ROOT_DIR}"

npm run build

ssh "${REMOTE_HOST}" "mkdir -p '${REMOTE_FRONTEND_DIR}'"
rsync -av --delete "${ROOT_DIR}/dist/" "${REMOTE_HOST}:${REMOTE_FRONTEND_DIR}/"

echo "Frontend deployed to ${REMOTE_FRONTEND_DIR}"
