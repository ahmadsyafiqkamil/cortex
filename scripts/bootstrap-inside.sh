#!/usr/bin/env bash
# bootstrap-inside.sh — One-time interactive setup INSIDE the Cortex dev container.
#
# Run this AFTER `scripts/deploy-vps.sh` has built and started the container:
#   docker compose exec -it cortex-dev bash
#   bash /workspace/scripts/bootstrap-inside.sh
#
# Prerequisites: container must be running with sui-config and walrus-config volumes.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

_log()  { echo -e "${CYAN}[bootstrap]${NC} $*"; }
_ok()   { echo -e "${GREEN}[   ok   ]${NC} $*"; }
_warn() { echo -e "${YELLOW}[  warn  ]${NC} $*"; }
_err()  { echo -e "${RED}[ ERROR  ]${NC} $*"; }
_step() { echo -e "\n${BOLD}── Step $1: $2 ──${NC}"; }

_confirm() {
    local prompt="$1"
    local yn
    read -r -p "$(echo -e "${CYAN}[bootstrap]${NC} ${prompt} [Y/n] ")" yn
    case "${yn:-y}" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# ── pre-flight checks ──────────────────────────────────────────────────

echo ""
_bold "======================================================"
_bold "  Cortex — One-Time Bootstrap (inside container)"
_bold "======================================================"
echo ""

if ! command -v sui >/dev/null 2>&1; then
    _err "sui CLI not found. Run 'suiup default set sui@testnet' first."
    exit 1
fi
if ! command -v walrus >/dev/null 2>&1; then
    _err "walrus CLI not found. Run 'suiup default set walrus@testnet' first."
    exit 1
fi
_ok "Tooling: sui $(sui --version 2>/dev/null | head -1), walrus $(walrus --version 2>/dev/null | head -1)"

# ── Step 1: Sui testnet + two addresses ────────────────────────────────

_step "1" "Sui testnet + addresses (Agent A & B)"

ALREADY_CONFIGURED=false
if sui client active-env 2>/dev/null | grep -q testnet; then
    ADDR_COUNT=$(sui client addresses 2>/dev/null | grep -c '0x' || true)
    if [ "${ADDR_COUNT:-0}" -ge 2 ]; then
        _ok "Already configured: testnet active, ${ADDR_COUNT} address(es)"
        sui client addresses 2>/dev/null
        ALREADY_CONFIGURED=true
    fi
fi

if [ "$ALREADY_CONFIGURED" = false ]; then
    _log "Running Sui client wizard..."
    _log "  -> Choose: testnet fullnode"
    _log "  -> Key scheme: ed25519"
    echo ""
    sui client

    _log "Creating second address (Agent B)..."
    sui client new-address ed25519

    echo ""
    _ok "Addresses created:"
    sui client addresses
fi

# ── Step 2: Faucet ─────────────────────────────────────────────────────

_step "2" "Faucet (SUI testnet tokens)"

ADDRS=($(sui client addresses 2>/dev/null | grep '^0x' | awk '{print $1}'))
if [ ${#ADDRS[@]} -lt 2 ]; then
    _err "Need at least 2 addresses (Agent A + Agent B). Only found ${#ADDRS[@]}."
    exit 1
fi

for ADDR in "${ADDRS[@]}"; do
    sui client switch --address "$ADDR" >/dev/null 2>&1
    BALANCE=$(sui client balance 2>/dev/null | grep -oE '[0-9.]+' | head -1 || echo "0")
    if [ "${BALANCE:-0}" = "0" ]; then
        _log "Address $ADDR: requesting faucet..."
        sui client faucet 2>/dev/null && _ok "Faucet OK" || _warn "Faucet may be rate-limited — try Discord/web faucet: https://discord.gg/sui"
    else
        _ok "Address $ADDR already has SUI: $BALANCE"
    fi
done

echo ""
_ok "Final balances:"
for ADDR in "${ADDRS[@]}"; do
    sui client switch --address "$ADDR" >/dev/null 2>&1
    sui client balance 2>/dev/null
done

# ── Step 3: Walrus config + WAL tokens ─────────────────────────────────

_step "3" "Walrus testnet + WAL tokens"

WALRUS_CONFIG="$HOME/.config/walrus"
mkdir -p "$WALRUS_CONFIG"

if [ ! -f "$WALRUS_CONFIG/client_config.yaml" ]; then
    _log "Fetching Walrus testnet client config..."
    if curl -fsSL "https://raw.githubusercontent.com/MystenLabs/walrus-docs/refs/heads/main/docs/testnet/client_config.yaml" \
        -o "$WALRUS_CONFIG/client_config.yaml" 2>/dev/null; then
        _ok "Walrus client config downloaded"
    else
        _warn "Could not auto-download config. See docs.wal.app/docs/getting-started for manual setup."
    fi
else
    _ok "Walrus client config already exists"
fi

_log "Verifying Walrus connection..."
if walrus info --context testnet 2>/dev/null; then
    _ok "Walrus testnet: connected"
else
    _warn "Walrus connection failed — check config at $WALRUS_CONFIG"
fi

_log "Getting WAL tokens (swap SUI -> WAL)..."
if walrus get-wal 2>/dev/null; then
    _ok "WAL tokens acquired"
else
    _warn "walrus get-wal failed — check walrus --help for token acquisition"
fi

# ── Step 4: Smoke test store/read ──────────────────────────────────────

_step "4" "Walrus smoke test (store + read)"

SMOKE_TEXT="cortex smoke test $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "$SMOKE_TEXT" > /tmp/smoke.txt

BLOB_ID=$(walrus store /tmp/smoke.txt --epochs max --context testnet 2>&1 | tee /dev/stderr | grep -oE '[A-Za-z0-9_-]{43,}' | head -1)
if [ -z "$BLOB_ID" ]; then
    _err "Could not extract blob_id from store output"
    exit 1
fi

_ok "Stored blob: $BLOB_ID"
READ_BACK=$(walrus read "$BLOB_ID" --context testnet 2>/dev/null)

if echo "$READ_BACK" | grep -qF "$SMOKE_TEXT"; then
    _ok "Smoke test PASSED: store -> read matches"
else
    _err "Smoke test FAILED: stored and read content differ"
    exit 1
fi

# ── Step 5: Python venv + install ──────────────────────────────────────

_step "5" "Python environment"

cd /workspace/agent

if [ -d ".venv" ]; then
    _ok "Virtualenv already exists"
else
    _log "Creating virtualenv..."
    python3 -m venv .venv
    _ok "Virtualenv created"
fi

source .venv/bin/activate
_log "Installing Python dependencies..."
pip install -r requirements.txt -q 2>&1 | tail -5
_ok "Python dependencies installed"

# ── Step 6: LLM smoke test ─────────────────────────────────────────────

_step "6" "LLM smoke test"

if python -m cortex_cli llm-smoke 2>/dev/null; then
    _ok "LLM smoke test PASSED"
else
    _warn "LLM smoke test FAILED — check .env values: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL"
    _warn "You can re-run: cd /workspace/agent && source .venv/bin/activate && python -m cortex_cli llm-smoke"
fi

# ── Step 7: Frontend pre-build ─────────────────────────────────────────

_step "7" "Frontend (Vite + React)"

cd /workspace/site
if [ -d "node_modules" ]; then
    _ok "node_modules already present"
else
    _log "Installing site dependencies (pnpm)..."
    pnpm install 2>&1 | tail -5
    _ok "pnpm install done"
fi

if pnpm run build 2>&1 | tail -5; then
    _ok "Site build PASSED -> dist/"
else
    _warn "Site build had issues — check output above"
fi

# ── Done ────────────────────────────────────────────────────────────────

echo ""
_bold "======================================================"
_bold "  Bootstrap complete!"
_bold "======================================================"
echo ""
echo "  Summary:"
echo "    Sui testnet:   $(sui client active-env 2>/dev/null)"
echo "    Addresses:     $(sui client addresses 2>/dev/null | grep -c '0x') keypair(s)"
echo "    Walrus:        connected (testnet)"
echo "    Python venv:   /workspace/agent/.venv"
echo "    Site build:    /workspace/site/dist/"
echo ""
echo "  Quick start:"
echo "    cd /workspace/agent && source .venv/bin/activate"
echo "    python -m cortex_cli --help"
echo ""
echo "  Deploy Walrus Site (from inside container):"
echo "    cd /workspace/site && pnpm run build"
echo "    site-builder --context=testnet deploy --epochs max site/dist"
echo ""
_bold "======================================================"
echo ""
