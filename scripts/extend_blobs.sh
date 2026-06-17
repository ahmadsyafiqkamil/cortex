#!/usr/bin/env bash
# extend_blobs.sh — Extend Walrus blob epochs to prevent expiry.
#
# Walrus testnet epochs are ~1 day. Run this script periodically (e.g. weekly
# cron) to keep all blobs alive until Demo Day (20-21 July 2026).
#
# Usage:
#   Inside container:      bash scripts/extend_blobs.sh
#   Inside container (do): bash scripts/extend_blobs.sh --do
#   From VPS host:         bash scripts/extend-blobs-cron.sh
#
# With --do, the script actually executes `walrus extend` for each blob.
# Without --do, it prints the list and instructions (reminder mode).
#
# Prerequisites: walrus CLI, SUI + WAL tokens in active address.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

_log()  { echo -e "${CYAN}[extend]${NC} $*"; }
_ok()   { echo -e "${GREEN}[  ok  ]${NC} $*"; }
_warn() { echo -e "${YELLOW}[ warn ]${NC} $*"; }
_err()  { echo -e "${RED}[ERROR ]${NC} $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CACHE_DIR="$PROJECT_DIR/agent/.cortex/cache"

DRY_RUN=true
if [ "${1:-}" = "--do" ]; then
    DRY_RUN=false
    _log "DRY RUN disabled — will actually extend blobs"
fi

# ── collect blob IDs ───────────────────────────────────────────────────

_log "Collecting blob IDs..."

ALL_BLOBS=()

# From local cache
if [ -d "$CACHE_DIR" ]; then
    for f in "$CACHE_DIR"/*; do
        if [ -f "$f" ]; then
            ALL_BLOBS+=("$(basename "$f")")
        fi
    done
fi

# From Walrus sites (if deploy happened)
if command -v sui >/dev/null 2>&1 && [ -f "$PROJECT_DIR/site/sites.yaml" ]; then
    _log "Checking for site blob references..."
fi

if [ ${#ALL_BLOBS[@]} -eq 0 ]; then
    _warn "No blobs found in cache. Nothing to extend."
    exit 0
fi

_log "Found ${#ALL_BLOBS[@]} blob(s)"

# ── extend or remind ───────────────────────────────────────────────────

if [ "$DRY_RUN" = false ]; then
    _log "Extending epochs..."
    SUCCESS=0
    FAILED=0

    for blob in "${ALL_BLOBS[@]}"; do
        if walrus extend "$blob" --epochs max --context testnet 2>&1; then
            ((SUCCESS++))
        else
            _warn "Failed to extend: $blob"
            ((FAILED++))
        fi
    done

    echo ""
    _ok "Extended: $SUCCESS blob(s)"
    if [ "$FAILED" -gt 0 ]; then
        _warn "Failed: $FAILED blob(s)"
    fi
else
    echo ""
    echo "================================================================================"
    echo "  REMINDER: Walrus testnet epochs are ~1 day."
    echo "  Demo Day: 20-21 July 2026."
    echo ""
    echo "  To actually extend blobs, run with --do:"
    echo "    bash scripts/extend_blobs.sh --do"
    echo ""
    echo "  Or manually:"
    echo "    for blob in \$(ls agent/.cortex/cache/); do"
    echo "      walrus extend \$blob --epochs max --context testnet"
    echo "    done"
    echo "================================================================================"
    echo ""

    _log "Blob IDs:"
    printf '  %s\n' "${ALL_BLOBS[@]}" | head -40

    if [ ${#ALL_BLOBS[@]} -gt 40 ]; then
        _log "... and $((${#ALL_BLOBS[@]} - 40)) more"
    fi
fi

_ok "Done."
