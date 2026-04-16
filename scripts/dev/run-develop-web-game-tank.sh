#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
WEB_GAME_CLIENT="${WEB_GAME_CLIENT:-$CODEX_HOME/skills/develop-web-game/scripts/web_game_playwright_client.js}"
ACTIONS_FILE="${WEB_GAME_ACTIONS:-$PWD/scripts/dev/tank-harness-actions.json}"
URL="${1:-http://localhost:5173/dev/tank-harness}"
OUT_DIR="${2:-output/web-game/tank-harness}"
LOCAL_CLIENT_COPY="$PWD/.tmp-web-game-playwright-client.mjs"

if [[ ! -f "$WEB_GAME_CLIENT" ]]; then
  echo "develop-web-game client bulunamadı: $WEB_GAME_CLIENT" >&2
  exit 1
fi

if [[ ! -f "$ACTIONS_FILE" ]]; then
  echo "Action payload bulunamadı: $ACTIONS_FILE" >&2
  exit 1
fi

cp "$WEB_GAME_CLIENT" "$LOCAL_CLIENT_COPY"
trap 'rm -f "$LOCAL_CLIENT_COPY"' EXIT

node "$LOCAL_CLIENT_COPY" \
  --url "$URL" \
  --actions-file "$ACTIONS_FILE" \
  --click-selector "[data-testid='tank-fire-button']" \
  --iterations 4 \
  --pause-ms 220 \
  --screenshot-dir "$OUT_DIR"

echo "Playwright harness tamamlandı: $OUT_DIR"
