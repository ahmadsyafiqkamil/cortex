#!/usr/bin/env python3
"""Deploy Cortex to Sui testnet (Task 3.2).

Sequence:
  1. Verify environment (sui testnet, two addresses, Agent A has gas)
  2. Publish Move package → package_id
  3. create_wiki → wiki_id (shared) + owner_cap_id (WikiOwnerCap)
  4. mint_contributor_cap for Agent A → cap_a
  5. mint_contributor_cap for Agent B → cap_b
  6. Write all IDs to agent/.cortex/config.json

Usage (from repo root):
  python scripts/deploy_testnet.py
  python scripts/deploy_testnet.py --agent-a 0xAAAA... --agent-b 0xBBBB...
  python scripts/deploy_testnet.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

# Allow running from repo root without installing the package
_REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_REPO_ROOT / "agent"))

from chain.client import AgentIdentity, ChainClient, ChainConfig, ChainError  # noqa: E402

MOVE_DIR = _REPO_ROOT / "move" / "cortex"
WIKI_NAME = "Cortex"
CLOCK_OBJECT = "0x6"  # System shared Clock object on all Sui networks


# ── Object-change parsing helpers ────────────────────────────────────────────

def find_created(result: dict, type_suffix: str, *, shared: bool = False, owner: str | None = None) -> str:
    """Return the objectId of a created object matching type_suffix.

    Args:
        result:      Full transaction result dict (has ``objectChanges`` key).
        type_suffix: Trailing portion of objectType to match, e.g. ``::wiki::Wiki``.
        shared:      If True, match shared objects (owner == ``Shared``).
        owner:       If given, match only objects owned by this address.

    Raises:
        ChainError: If no matching object is found.
    """
    for change in result.get("objectChanges", []):
        if change.get("type") != "created":
            continue
        obj_type: str = change.get("objectType", "")
        if not obj_type.endswith(type_suffix):
            continue

        obj_owner = change.get("owner", {})
        if shared:
            if "Shared" not in str(obj_owner):
                continue
        elif owner is not None:
            addr_owner = obj_owner.get("AddressOwner", "")
            if addr_owner.lower() != owner.lower():
                continue

        obj_id: str = change.get("objectId", "")
        if obj_id:
            return obj_id

    raise ChainError(
        f"Could not find created object of type *{type_suffix} "
        f"(shared={shared}, owner={owner}) in objectChanges.\n"
        f"Changes: {json.dumps(result.get('objectChanges', []), indent=2)}"
    )


# ── Sui address utilities ────────────────────────────────────────────────────

def get_all_addresses() -> list[str]:
    """Return all addresses known to the local Sui keystore."""
    result = subprocess.run(
        ["sui", "client", "addresses", "--json"],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        raise ChainError(f"sui client addresses failed:\n{result.stderr[:400]}")
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise ChainError(f"sui client addresses returned non-JSON: {result.stdout[:300]!r}") from exc

    # Response shape: {"activeAddress": "0x...", "addresses": [["alias", "0x..."], ...]}
    if isinstance(data, dict):
        addrs = data.get("addresses", [])
        return [entry[1] if isinstance(entry, list) else entry for entry in addrs]
    if isinstance(data, list):
        return [entry[1] if isinstance(entry, list) else str(entry) for entry in data]
    raise ChainError(f"Unexpected shape from sui client addresses: {type(data)}")


def switch_address(address: str) -> None:
    """Set the active Sui address."""
    result = subprocess.run(
        ["sui", "client", "switch", "--address", address],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        raise ChainError(f"sui client switch failed:\n{result.stderr[:400]}")


def switch_env(env: str = "testnet") -> None:
    """Ensure the active Sui environment matches the target."""
    result = subprocess.run(
        ["sui", "client", "switch", "--env", env],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        raise ChainError(
            f"sui client switch --env {env} failed:\n{result.stderr[:400]}\n"
            f"Check available envs: sui client envs"
        )


# ── Main deploy orchestration ────────────────────────────────────────────────

def deploy(addr_a: str | None, addr_b: str | None, dry_run: bool) -> None:
    client = ChainClient()

    # ── Step 1: Resolve addresses ──────────────────────────────────────────
    print("Step 1/6 — Resolving agent addresses ...")
    all_addrs = get_all_addresses()
    if not all_addrs:
        raise ChainError(
            "No Sui addresses found in local keystore.\n"
            "Run: sui client (first-run wizard) to create keypair(s)."
        )

    if addr_a is None:
        addr_a = client.get_active_address()
        print(f"  Agent A (active address): {addr_a}")
    if addr_b is None:
        others = [a for a in all_addrs if a.lower() != addr_a.lower()]
        if not others:
            raise ChainError(
                "Only one address found in keystore — two are required.\n"
                "Create Agent B keypair: sui client new-address ed25519\n"
                "Then fund it: sui client switch --address <ADDR_B> && sui client faucet"
            )
        addr_b = others[0]
        print(f"  Agent B (second address):  {addr_b}")

    if addr_a.lower() == addr_b.lower():
        raise ChainError("Agent A and Agent B must be different addresses (hard rule #3).")

    # ── Step 2: Verify gas ─────────────────────────────────────────────────
    print(f"\nStep 2/6 — Checking gas on Agent A ({addr_a}) ...")
    switch_env("testnet")
    switch_address(addr_a)
    balance = client.get_balance()
    print(f"  Balance: {balance} MIST ({balance / 1_000_000_000:.4f} SUI)")
    if balance == 0:
        raise ChainError(
            f"Agent A ({addr_a}) has 0 SUI — cannot pay gas.\n"
            "Fund via faucet:\n"
            "  sui client faucet\n"
            "Or web faucet: https://faucet.testnet.sui.io"
        )
    if balance < 200_000_000:
        print("  WARNING: Low balance (<0.2 SUI). Publish may fail. Consider: sui client faucet")

    if dry_run:
        print("\n[DRY RUN] Stopping before on-chain operations. All checks passed.")
        return

    # ── Step 3: Publish package ────────────────────────────────────────────
    print(f"\nStep 3/6 — Publishing Move package from {MOVE_DIR} ...")
    publish_result = client.publish(MOVE_DIR)
    package_id = client.config.package_id
    if not package_id:
        raise ChainError("publish() returned without setting package_id — check objectChanges above.")
    print(f"  OK package_id: {package_id}")

    # ── Step 4: create_wiki ────────────────────────────────────────────────
    print(f'\nStep 4/6 — Calling create_wiki("{WIKI_NAME}") ...')
    cw_result = client.call_move(
        module="wiki",
        function="create_wiki",
        args=[WIKI_NAME, CLOCK_OBJECT],
        gas_budget=10_000_000,
    )
    wiki_id = find_created(cw_result, "::wiki::Wiki", shared=True)
    owner_cap_id = find_created(cw_result, "::wiki::WikiOwnerCap", owner=addr_a)
    print(f"  OK wiki_id (shared):  {wiki_id}")
    print(f"  OK owner_cap_id:      {owner_cap_id}")

    # ── Step 5: mint ContributorCap for A ─────────────────────────────────
    print(f"\nStep 5/6 — Minting ContributorCap for Agent A ({addr_a}) ...")
    cap_a_result = client.call_move(
        module="wiki",
        function="mint_contributor_cap",
        args=[owner_cap_id, wiki_id, addr_a],
        gas_budget=10_000_000,
    )
    cap_a = find_created(cap_a_result, "::wiki::ContributorCap", owner=addr_a)
    print(f"  OK cap_a: {cap_a}")

    # ── Step 6: mint ContributorCap for B ─────────────────────────────────
    print(f"\nStep 6/6 — Minting ContributorCap for Agent B ({addr_b}) ...")
    cap_b_result = client.call_move(
        module="wiki",
        function="mint_contributor_cap",
        args=[owner_cap_id, wiki_id, addr_b],
        gas_budget=10_000_000,
    )
    cap_b = find_created(cap_b_result, "::wiki::ContributorCap", owner=addr_b)
    print(f"  OK cap_b: {cap_b}")

    # ── Persist config ─────────────────────────────────────────────────────
    client.config.wiki_id = wiki_id
    client.config.owner_cap_id = owner_cap_id
    client.config.agent_a = AgentIdentity(address=addr_a, contributor_cap=cap_a)
    client.config.agent_b = AgentIdentity(address=addr_b, contributor_cap=cap_b)
    client.config.save()
    print("\n  Config saved -> agent/.cortex/config.json")

    # ── Summary ────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("DEPLOY COMPLETE — copy these into CLAUDE.md State proyek:")
    print("=" * 60)
    print(f"  package_id:              {package_id}")
    print(f"  wiki_id:                 {wiki_id}")
    print(f"  owner_cap_id:            {owner_cap_id}")
    print(f"  agent_a.address:         {addr_a}")
    print(f"  agent_a.contributor_cap: {cap_a}")
    print(f"  agent_b.address:         {addr_b}")
    print(f"  agent_b.contributor_cap: {cap_b}")
    print()
    print(f"  Explorer: https://suiscan.xyz/testnet/object/{wiki_id}")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--agent-a", metavar="ADDRESS",
        help="Sui address for Agent A (ingest/owner). Default: active address.",
    )
    parser.add_argument(
        "--agent-b", metavar="ADDRESS",
        help="Sui address for Agent B (lint/dispute). Default: second address in keystore.",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Check prerequisites only; do not publish or call Move functions.",
    )
    args = parser.parse_args()

    try:
        deploy(addr_a=args.agent_a, addr_b=args.agent_b, dry_run=args.dry_run)
    except ChainError as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nAborted.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
