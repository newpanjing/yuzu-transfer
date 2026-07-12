#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_HOST="root@noondot.com"
REMOTE_BACKEND_DIR="/opt/www/kc"
REMOTE_BINARY_NAME="kc"
REMOTE_BINARY_PATH="${REMOTE_BACKEND_DIR}/${REMOTE_BINARY_NAME}"
REMOTE_BINARY_TEMP_PATH="${REMOTE_BINARY_PATH}.new"
REMOTE_START_SCRIPT="${REMOTE_BACKEND_DIR}/start.sh"
REMOTE_PM2_BIN="/opt/www/node-v20.12.2-linux-x64/bin/pm2"

APP_PORT="18080"
TURN_PORT="3478"
TURN_PUBLIC_IP="47.106.102.109"
TURN_REALM="yuzu-transfer"
TURN_USERNAME="yuzu"
TURN_PASSWORD="yuzu-turn"
TURN_BIND_HOST="0.0.0.0"

LOCAL_BUILD_DIR="${ROOT_DIR}/release"
LOCAL_BINARY_PATH="${LOCAL_BUILD_DIR}/${REMOTE_BINARY_NAME}-linux-amd64"
LOCAL_START_SCRIPT="${LOCAL_BUILD_DIR}/start.sh"

mkdir -p "${LOCAL_BUILD_DIR}"

if [[ -d /opt/homebrew/opt/go/libexec ]]; then
  export GOROOT="/opt/homebrew/opt/go/libexec"
  export PATH="/opt/homebrew/opt/go/bin:${PATH}"
fi

cd "${ROOT_DIR}/server"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o "${LOCAL_BINARY_PATH}" .

cat > "${LOCAL_START_SCRIPT}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "${REMOTE_BACKEND_DIR}"
export APP_PORT=${APP_PORT}
export TURN_PORT=${TURN_PORT}
export TURN_PUBLIC_IP=${TURN_PUBLIC_IP}
export TURN_REALM=${TURN_REALM}
export TURN_USERNAME=${TURN_USERNAME}
export TURN_PASSWORD=${TURN_PASSWORD}
export TURN_BIND_HOST=${TURN_BIND_HOST}
${REMOTE_PM2_BIN} delete kc >/dev/null 2>&1 || true
${REMOTE_PM2_BIN} start ${REMOTE_BINARY_PATH} --name kc
${REMOTE_PM2_BIN} save
EOF

chmod +x "${LOCAL_START_SCRIPT}"

ssh "${REMOTE_HOST}" "mkdir -p '${REMOTE_BACKEND_DIR}'"
scp "${LOCAL_BINARY_PATH}" "${REMOTE_HOST}:${REMOTE_BINARY_TEMP_PATH}"
scp "${LOCAL_START_SCRIPT}" "${REMOTE_HOST}:${REMOTE_START_SCRIPT}"

ssh "${REMOTE_HOST}" "
set -euo pipefail
mv '${REMOTE_BINARY_TEMP_PATH}' '${REMOTE_BINARY_PATH}'
chmod +x '${REMOTE_BINARY_PATH}' '${REMOTE_START_SCRIPT}'
if [ ! -x '${REMOTE_PM2_BIN}' ]; then
  echo 'pm2 not found: ${REMOTE_PM2_BIN}' >&2
  exit 1
fi
'${REMOTE_START_SCRIPT}'
'${REMOTE_PM2_BIN}' status kc
"

echo "Backend deployed to ${REMOTE_BACKEND_DIR}"
