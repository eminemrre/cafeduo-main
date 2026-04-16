#!/usr/bin/env bash
set -euo pipefail

WORKFLOW="${DEPLOY_WORKFLOW:-deploy-vps.yml}"
REF="${DEPLOY_REF:-$(git rev-parse --abbrev-ref HEAD)}"

if ! command -v gh >/dev/null 2>&1; then
  echo "[deploy:vds] GitHub CLI (gh) not found."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "[deploy:vds] GitHub auth missing. Run: gh auth login"
  exit 1
fi

echo "[deploy:vds] Dispatching workflow '${WORKFLOW}' for ref '${REF}'..."
gh workflow run "${WORKFLOW}" --ref "${REF}"

echo "[deploy:vds] Waiting for workflow run to appear..."
sleep 3

RUN_ID="$(
  gh run list \
    --workflow "${WORKFLOW}" \
    --branch "${REF}" \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId'
)"

if [[ -z "${RUN_ID}" || "${RUN_ID}" == "null" ]]; then
  echo "[deploy:vds] Unable to resolve workflow run id."
  exit 1
fi

RUN_URL="$(gh run view "${RUN_ID}" --json url --jq '.url')"
echo "[deploy:vds] Run URL: ${RUN_URL}"
echo "[deploy:vds] Watching run..."

gh run watch "${RUN_ID}" --interval 10 --exit-status
echo "[deploy:vds] Deployment workflow completed successfully."
