#!/usr/bin/env bash
# Cortex dev container entrypoint.
#
# suiup installs the binaries but a fresh container may not have a *default* version
# selected, so `sui`/`walrus`/`site-builder` won't resolve on PATH. Setting the default
# is a LOCAL operation (no network) — so this runs reliably even when GitHub's API is
# rate-limited at build time. Idempotent; safe to run on every start.
set -euo pipefail

# Only set a default when the tool doesn't already resolve — avoids rewriting the
# binary on every start (which can briefly cause ETXTBSY for an immediate exec).
command -v sui          >/dev/null 2>&1 || suiup default set sui@testnet          >/dev/null 2>&1 || true
command -v walrus       >/dev/null 2>&1 || suiup default set walrus@testnet       >/dev/null 2>&1 || true
command -v site-builder >/dev/null 2>&1 || suiup default set site-builder@mainnet >/dev/null 2>&1 || true

exec "$@"
