#!/usr/bin/env bash
# redeploy.sh — One-command rebuild + deploy to Walrus testnet.
#
# Usage:
#   bash scripts/redeploy.sh           # full rebuild + deploy
#   bash scripts/redeploy.sh --skip-build  # skip build, deploy dist/
#
# Requires: docker compose running, cortex-dev container up.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

_log()  { echo -e "${CYAN}[deploy]${NC} $*"; }
_ok()   { echo -e "${GREEN}[  ok  ]${NC} $*"; }
_err()  { echo -e "${RED}[ERROR ]${NC} $*"; }

SKIP_BUILD=false
if [[ "${1:-}" == "--skip-build" ]]; then
  SKIP_BUILD=true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PORTAL_CONFIG="$PROJECT_DIR/site/portal-config.yaml"
DEV_CONTAINER="cortex-dev"

cd "$PROJECT_DIR"

# ── Step 1: Build ────────────────────────────────────────────────────────────
if $SKIP_BUILD; then
  if [ ! -d "$PROJECT_DIR/site/dist" ]; then
    _log "dist/ not found, auto-enabling build..."
    SKIP_BUILD=false
  else
    _ok "Skipping build (--skip-build)"
  fi
fi

if ! $SKIP_BUILD; then
  _log "Building site..."
  docker compose exec -T "$DEV_CONTAINER" bash -c 'cd /workspace/site && pnpm run build'
  _ok "Build complete"
fi

# ── Step 2: Deploy ───────────────────────────────────────────────────────────
_log "Deploying to Walrus testnet..."
DEPLOY_OUTPUT=$(docker compose exec -T "$DEV_CONTAINER" bash -c 'cd /workspace/site && rm -f dist/ws-resources.json && site-builder --context=testnet deploy --epochs max dist 2>&1')
DEPLOY_CLEAN=$(echo "$DEPLOY_OUTPUT" | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g')

SITE_OID=$(echo "$DEPLOY_CLEAN" | grep -oiP 'New site object ID: \K0x[a-f0-9]+' || true)
B36_SLUG=$(echo "$DEPLOY_CLEAN" | grep -oP 'http://\K[a-z0-9]+(?=\.localhost:3000)' || true)

if [ -z "$SITE_OID" ] || [ -z "$B36_SLUG" ]; then
  _err "Failed to parse site object ID or b36 slug from deploy output."
  exit 1
fi

_ok "Site Object ID: $SITE_OID"
_ok "B36 slug:        $B36_SLUG"

# ── Step 3: Update portal config ─────────────────────────────────────────────
_log "Updating portal config..."
sed -i -E "s/landing_page_oid_b36: \".*\"/landing_page_oid_b36: \"$B36_SLUG\"/" "$PORTAL_CONFIG"
_ok "portal-config.yaml updated"

# ── Step 4: Restart ──────────────────────────────────────────────────────────
_log "Restarting portal + nginx..."
docker compose restart walrus-portal >/dev/null 2>&1
sleep 3
docker compose restart nginx >/dev/null 2>&1
sleep 5
_ok "Portal + nginx restarted"

# ── Step 5: Verify ───────────────────────────────────────────────────────────
_log "Verifying site..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:3000/")
if [ "$HTTP_CODE" == "200" ]; then
  TITLE=$(curl -s --max-time 5 "http://localhost:3000/" | grep -oP '<title>\K[^<]+' || echo "OK")
  _ok "Site online — $TITLE"
else
  _err "Site returned HTTP $HTTP_CODE"
  exit 1
fi

# ── Summary ──────────────────────────────────────────────────────────────────
SERVER_IP="${SERVER_IP:-$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -v -E '^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)' | head -1)}"
if [ -z "${SERVER_IP:-}" ]; then
  SERVER_IP="$(curl -sf --max-time 3 ifconfig.me 2>/dev/null || echo "")"
fi
echo ""
echo -e "${BOLD}======================================${NC}"
echo -e "${BOLD}  Deploy complete${NC}"
echo -e "${BOLD}======================================${NC}"
echo ""
echo -e "  Site Object ID: ${GREEN}$SITE_OID${NC}"
echo -e "  B36 slug:       ${GREEN}$B36_SLUG${NC}"
echo ""
echo -e "  Local:      http://localhost:3000/"
if [ -n "${SERVER_IP:-}" ]; then
  echo -e "  Public:     http://${SERVER_IP}:3000/"
  echo -e "  nip.io:     http://${B36_SLUG}.${SERVER_IP}.nip.io:3000/"
fi
echo ""
