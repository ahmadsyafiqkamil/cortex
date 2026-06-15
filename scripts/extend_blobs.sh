#!/usr/bin/env bash
# extend_blobs.sh — Extend Walrus blob epochs to prevent expiry.
#
# Walrus testnet epochs are ~1 day. Run this script periodically (e.g. weekly
# cron) to keep all blobs alive until Demo Day (20-21 July 2026).
#
# Usage: bash scripts/extend_blobs.sh
#
# Prerequisites: walrus CLI, SUI + WAL tokens in active address.
#
# NOTE: This is a reminder script. Actual blob extension in Walrus 1.50+ is
# handled via `walrus extend` (available in newer CLIs) or by re-storing the
# blob with updated epochs. This script prints the list of blob IDs that need
# extension so you can act manually if the CLI doesn't have `extend` yet.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CACHE_DIR="$PROJECT_DIR/agent/.cortex/cache"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

_log() { echo -e "${CYAN}[extend]${NC} $*"; }

_log "Checking blob cache at $CACHE_DIR"

if [ ! -d "$CACHE_DIR" ]; then
    echo "Cache directory not found. No blobs to check."
    exit 0
fi

BLOB_COUNT=$(ls -1 "$CACHE_DIR" 2>/dev/null | wc -l | tr -d ' ')
_log "Found $BLOB_COUNT cached blob(s)"

# Collect all blob IDs from:
# 1. Cache directory (local)
# 2. On-chain page records (if sui CLI available)
# 3. On-chain source records

ALL_BLOBS=()

# From cache
for f in "$CACHE_DIR"/*; do
    if [ -f "$f" ]; then
        ALL_BLOBS+=("$(basename "$f")")
    fi
done

_log "Total unique blob IDs: ${#ALL_BLOBS[@]}"

echo ""
echo "================================================================================"
echo "  REMINDER: Walrus testnet epochs are ~1 day."
echo "  Demo Day: 20-21 July 2026."
echo ""
echo "  To extend blobs (if walrus extend is available):"
echo "    for blob in \$(ls agent/.cortex/cache/); do"
echo "      walrus extend \$blob --epochs max --context testnet"
echo "    done"
echo ""
echo "  Schedule:"
echo "    - H-3 before shortlist (5 July): run this check"
echo "    - Before Demo Day (17 July):     run this check"
echo "  Or set a cron job:"
echo "    0 8 * * 1 cd $PROJECT_DIR && bash scripts/extend_blobs.sh"
echo "================================================================================"
echo ""

_log "Blob IDs requiring attention:"
printf '%s\n' "${ALL_BLOBS[@]}" | head -40

if [ ${#ALL_BLOBS[@]} -gt 40 ]; then
    _log "... and $((${#ALL_BLOBS[@]} - 40)) more"
fi

_log "${GREEN}Done.${NC} Next scheduled check: 5 July 2026 (H-3 before shortlist)."
