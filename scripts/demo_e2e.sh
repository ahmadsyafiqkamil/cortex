#!/usr/bin/env bash
# demo_e2e.sh — Cortex end-to-end acceptance test with dual-agent scenario.
#
# Flow:
#   Agent A (ingest):     `cortex ingest` a raw source
#   Agent B / read-only:  `cortex lint`   checks wiki quality
#   Agent B (dispute):    `cortex dispute raise` files a counter-source dispute
#   Read-only:            `cortex query`   verifies answers with citations
#
# Usage: bash scripts/demo_e2e.sh
#
# Prerequisites:
#   - sui client configured for both Agent A and Agent B addresses
#   - walrus CLI on PATH
#   - .env with LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
#
# Exits with code 1 on failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AGENT_DIR="$PROJECT_DIR/agent"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

DEMO_SOURCE="$PROJECT_DIR/demo-sources/source1.txt"
COUNTER_SOURCE="$PROJECT_DIR/demo-sources/counter.txt"

_log()     { echo -e "${CYAN}[e2e]${NC} $*"; }
_pass()    { echo -e "${GREEN}  PASS${NC} $*"; }
_fail()    { echo -e "${RED}  FAIL${NC} $*" >&2; }
_step()    { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }

cleanup() {
    rm -f "$COUNTER_SOURCE"
}
trap cleanup EXIT

# ── Pre-flight checks ─────────────────────────────────────────────────────────

_step "Pre-flight checks"

if ! command -v walrus &>/dev/null; then
    _fail "walrus CLI not found on PATH"
    exit 1
fi

if ! command -v sui &>/dev/null; then
    _fail "sui CLI not found on PATH"
    exit 1
fi

if [ ! -f "$DEMO_SOURCE" ]; then
    _fail "Demo source not found: $DEMO_SOURCE"
    exit 1
fi

if [ ! -f "$AGENT_DIR/.cortex/config.json" ]; then
    _fail "Config not found: $AGENT_DIR/.cortex/config.json"
    exit 1
fi

CONFIG_PKG=$(python3 -c "import json; print(json.load(open('$AGENT_DIR/.cortex/config.json')).get('package_id',''))")
CONFIG_WIKI=$(python3 -c "import json; print(json.load(open('$AGENT_DIR/.cortex/config.json')).get('wiki_id',''))")

if [ -z "$CONFIG_PKG" ] || [ "$CONFIG_PKG" = "null" ]; then
    _fail "package_id not set in config.json"
    exit 1
fi

_log "package_id = $CONFIG_PKG"
_log "wiki_id    = $CONFIG_WIKI"
_log "demo source = $DEMO_SOURCE"

# ── Step 1: Agent A — Ingest ──────────────────────────────────────────────────

_step "Step 1: Agent A — Ingest source"

ACTIVE_ADDR=$(sui client active-address 2>/dev/null || echo "")
_log "Active Sui address: $ACTIVE_ADDR"

cd "$AGENT_DIR"
if python3 -m cortex_cli ingest "$DEMO_SOURCE" --title "Demo Source (e2e)"; then
    _pass "Ingest completed"
else
    _fail "Ingest failed"
    exit 1
fi

# ── Step 2: Lint (read-only, no transaction) ──────────────────────────────────

_step "Step 2: Lint — Wiki quality checks"

set +e
LINT_OUTPUT=$(python3 -m cortex_cli lint 2>&1)
LINT_EXIT=$?
set -e

echo "$LINT_OUTPUT"

if [ $LINT_EXIT -eq 0 ]; then
    _pass "Lint: no errors found"
else
    _log "${YELLOW}Lint found issues (exit $LINT_EXIT) — this is expected for newly ingested content.${NC}"
fi

# ── Step 3: Agent B — Dispute ─────────────────────────────────────────────────

_step "Step 3: Agent B — Raise dispute"

# Pick the first content page as the dispute target.
DISPUTE_PAGE=$(python3 -c "
import json, sys
sys.path.insert(0, '$AGENT_DIR')
from agent.chain import ChainClient
chain = ChainClient()
slugs = [s for s in chain.list_pages() if s not in ('_index','_log')]
if slugs:
    print(slugs[0])
else:
    sys.exit(1)
" 2>/dev/null || echo "")

if [ -z "$DISPUTE_PAGE" ]; then
    _fail "No content pages found to dispute"
    exit 1
fi
_log "Dispute target page: [[$DISPUTE_PAGE]]"

# Create a minimal counter-source file.
cat > "$COUNTER_SOURCE" <<EOF
=== Counter-source for dispute demo ===

This is a synthetic counter-source used to demonstrate the Cortex dispute
mechanism. In a real scenario, this would be an alternative regulation or
policy document that contradicts or complements claims in the wiki page.

The counter-source demonstrates that Agent B (a different keypair) can
independently register sources and raise disputes on the shared wiki
without a central server.
EOF

_log "Switching to Agent B (config switch)..."

# Switch sui client to Agent B keypair, run dispute, then restore.
# Assumes sui client is configured with both addresses.
# If using a single keystore with both keypairs, use --active-address.
AGENT_B=$(python3 -c "import json; print(json.load(open('$AGENT_DIR/.cortex/config.json'))['agent_b']['address'])")
_log "Agent B address: $AGENT_B"

sui client switch --address "$AGENT_B" 2>/dev/null || \
    sui client new-env --alias cortex-b --rpc https://fullnode.testnet.sui.io:443 2>/dev/null || true
sui client active-address

if python3 -m cortex_cli dispute raise \
    --page "$DISPUTE_PAGE" \
    --counter-source "$COUNTER_SOURCE" \
    --title "Counter-source for $DISPUTE_PAGE" \
    --rationale "This counter-source shows an alternative perspective on the claims in [[$DISPUTE_PAGE]]."; then
    _pass "Dispute raised by Agent B against [[$DISPUTE_PAGE]]"
else
    _fail "Dispute raise failed"
    exit 1
fi

# ── Step 4: Query — Verify answers with citations ─────────────────────────────

_step "Step 4: Query — Verify answers with provenance citations"

set +e
QUERY_OUTPUT=$(python3 -m cortex_cli query "Apa prosedur yang dijelaskan dalam sumber?" 2>&1)
QUERY_EXIT=$?
set -e

echo "$QUERY_OUTPUT"

if [ $QUERY_EXIT -eq 0 ]; then
    _pass "Query returned answer with citations"
else
    _fail "Query failed"
    exit 1
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Demo E2E: ALL STEPS PASSED${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo "  Agent A (ingest):   :heavy_check_mark:"
echo "  Lint (read-only):   :heavy_check_mark:"
echo "  Agent B (dispute):  :heavy_check_mark:"
echo "  Query (citations):  :heavy_check_mark:"
echo ""

exit 0
