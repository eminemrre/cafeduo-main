#!/usr/bin/env bash
set -euo pipefail

if [ ! -f ".env" ]; then
  echo "[db-explain] .env not found in current directory"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  run_compose() { docker compose "$@"; }
else
  run_compose() { docker-compose "$@"; }
fi

DB_USER="${DB_USER:-$(grep -E '^DB_USER=' .env | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)}"
DB_NAME="${DB_NAME:-$(grep -E '^DB_NAME=' .env | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-cafeduo}"

GAME_TYPES="'reflex_rush','retro_chess','odd_even_sprint','knowledge_quiz'"

psql_explain_json() {
  local query="$1"
  run_compose -f deploy/docker-compose.prod.yml --env-file .env exec -T postgres \
    psql -U "${DB_USER}" -d "${DB_NAME}" -X -A -t -v ON_ERROR_STOP=1 \
    -c "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}"
}

emit_metric() {
  local label="$1"
  local payload="$2"
  if command -v python3 >/dev/null 2>&1; then
    DB_EXPLAIN_PAYLOAD="${payload}" python3 - "$label" <<'PY'
import json
import os
import sys

label = sys.argv[1]
payload = os.environ.get("DB_EXPLAIN_PAYLOAD", "").strip()
if not payload:
    print(f"DB_EXPLAIN_ERROR|{label}|empty_payload")
    raise SystemExit(0)

try:
    parsed = json.loads(payload)
    root = parsed[0] if isinstance(parsed, list) and parsed else parsed
    plan = root.get("Plan", {}) if isinstance(root, dict) else {}
    planning = float(root.get("Planning Time", 0.0)) if isinstance(root, dict) else 0.0
    execution = float(root.get("Execution Time", 0.0)) if isinstance(root, dict) else 0.0
    node = str(plan.get("Node Type", "unknown"))
    actual_rows = int(plan.get("Actual Rows", 0))
    loops = int(plan.get("Actual Loops", 0))
    print(
        f"DB_EXPLAIN_METRIC|{label}|planning_ms={planning:.3f}|execution_ms={execution:.3f}|node={node}|rows={actual_rows}|loops={loops}"
    )
except Exception as exc:
    print(f"DB_EXPLAIN_ERROR|{label}|{exc}")
PY
  else
    echo "DB_EXPLAIN_RAW|${label}|${payload}"
  fi
}

run_probe() {
  local label="$1"
  local query="$2"
  echo "[db-explain] ${label}"
  local output
  output="$(psql_explain_json "${query}")"
  emit_metric "${label}" "${output}"
}

run_probe \
  "waiting_games_global" \
  "SELECT id, host_name, game_type, points, table_code, status, guest_name, created_at FROM games WHERE status = 'waiting' AND game_type = ANY(ARRAY[${GAME_TYPES}]::text[]) ORDER BY created_at DESC LIMIT 100;"

run_probe \
  "waiting_games_by_table" \
  "SELECT id, host_name, game_type, points, table_code, status, guest_name, created_at FROM games WHERE status = 'waiting' AND game_type = ANY(ARRAY[${GAME_TYPES}]::text[]) AND table_code = 'MASA01' ORDER BY created_at DESC LIMIT 100;"

run_probe \
  "active_game_for_user" \
  "SELECT id, host_name, game_type, points, table_code, status, guest_name, player1_move, player2_move, game_state, created_at FROM games WHERE (host_name = 'perf_user' OR guest_name = 'perf_user') AND status = 'active' AND game_type = ANY(ARRAY[${GAME_TYPES}]::text[]) ORDER BY created_at DESC LIMIT 1;"

run_probe \
  "participant_pending_or_active" \
  "SELECT id, host_name, game_type, points, table_code, status, guest_name, created_at FROM games WHERE (host_name = 'perf_user' OR guest_name = 'perf_user') AND status IN ('waiting', 'active') ORDER BY created_at DESC LIMIT 1;"

run_probe \
  "active_player_conflict" \
  "SELECT id FROM games WHERE status = 'active' AND (host_name = 'perf_user' OR guest_name = 'perf_user') LIMIT 1;"

echo "[db-explain] done"
