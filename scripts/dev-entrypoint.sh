#!/usr/bin/env bash
# Cortex dev container entrypoint.
#
# suiup installs the binaries but a fresh container may not have a *default* version
# selected, so `sui`/`walrus`/`site-builder` won't resolve on PATH. Setting the default
# is a LOCAL operation (no network) — so this runs reliably even when GitHub's API is
# rate-limited at build time. Idempotent; safe to run on every start.
set -euo pipefail

# Named volumes mount as root:root, but the container runs as `cortex`. Without this,
# `sui`/`walrus` can't write their config dirs (e.g. ~/.sui/sui_config) and fail with
# "Permission denied (os error 13)". chown is cheap (dirs are tiny) and idempotent.
for d in "$HOME/.sui" "$HOME/.config/walrus"; do
  [ -d "$d" ] && [ "$(stat -c %U "$d" 2>/dev/null)" != "cortex" ] && sudo chown -R cortex:cortex "$d" || true
done

# Only set a default when the tool doesn't already resolve — avoids rewriting the
# binary on every start (which can briefly cause ETXTBSY for an immediate exec).
command -v sui          >/dev/null 2>&1 || suiup default set sui@testnet          >/dev/null 2>&1 || true
command -v walrus       >/dev/null 2>&1 || suiup default set walrus@testnet       >/dev/null 2>&1 || true
command -v site-builder >/dev/null 2>&1 || suiup default set site-builder@mainnet >/dev/null 2>&1 || true

exec "$@"
