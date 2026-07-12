#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/.tmp-file-transfer-test"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

npx tsc \
  --ignoreConfig \
  --target ES2022 \
  --module NodeNext \
  --moduleResolution NodeNext \
  --lib ES2022,DOM \
  --strict \
  --esModuleInterop \
  --outDir "$BUILD_DIR" \
  "$ROOT_DIR/src/lib/fileTransfer.ts" \
  "$ROOT_DIR/scripts/test_file_transfer.ts"

node "$BUILD_DIR/scripts/test_file_transfer.js"
