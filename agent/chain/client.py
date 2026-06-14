"""Sui chain interaction layer.

Wraps `sui client` CLI subprocess calls. All network I/O goes through the
binary (no direct RPC) so we inherit whatever environment the user has
configured (testnet, mainnet, etc.).

Config is loaded from agent/.cortex/config.json when it exists; callers can
also pass overrides directly. Package ID and object IDs are stored there after
publish — never hardcoded here.
"""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

_CONFIG_PATH = Path(__file__).parent.parent / ".cortex" / "config.json"


class ChainError(RuntimeError):
    """Raised when a sui client call fails or returns unexpected output."""


@dataclass
class ChainConfig:
    package_id: str = ""
    wiki_id: str = ""
    owner_cap_id: str = ""
    network: str = "testnet"
    extra: dict = field(default_factory=dict)

    @classmethod
    def load(cls, path: Path = _CONFIG_PATH) -> "ChainConfig":
        if not path.exists():
            return cls()
        try:
            data = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError) as exc:
            raise ChainError(f"Cannot read config at {path}: {exc}") from exc
        return cls(
            package_id=data.get("package_id", ""),
            wiki_id=data.get("wiki_id", ""),
            owner_cap_id=data.get("owner_cap_id", ""),
            network=data.get("network", "testnet"),
            extra={k: v for k, v in data.items() if k not in ("package_id", "wiki_id", "owner_cap_id", "network")},
        )

    def save(self, path: Path = _CONFIG_PATH) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        data: dict = {
            "package_id": self.package_id,
            "wiki_id": self.wiki_id,
            "owner_cap_id": self.owner_cap_id,
            "network": self.network,
            **self.extra,
        }
        path.write_text(json.dumps(data, indent=2))


class ChainClient:
    """Thin wrapper around `sui client` subprocess calls."""

    def __init__(self, config: ChainConfig | None = None) -> None:
        self.config = config or ChainConfig.load()

    # ── Low-level subprocess helper ──────────────────────────────────────────

    def _sui(self, args: list[str], *, json_out: bool = True) -> dict | str:
        """Run `sui client <args>` and return parsed JSON or raw string."""
        cmd = ["sui", "client"] + args
        if json_out:
            cmd.append("--json")
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
            )
        except FileNotFoundError as exc:
            raise ChainError(
                "sui binary not found. Make sure the Sui CLI is installed and on PATH."
            ) from exc
        except subprocess.TimeoutExpired as exc:
            raise ChainError(f"sui client timed out running: {' '.join(cmd)}") from exc

        if result.returncode != 0:
            raise ChainError(
                f"sui client failed (exit {result.returncode}):\n"
                f"stdout: {result.stdout[:500]}\n"
                f"stderr: {result.stderr[:500]}"
            )

        if not json_out:
            return result.stdout

        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            raise ChainError(
                f"sui client returned non-JSON output: {result.stdout[:300]!r}"
            ) from exc

    # ── High-level helpers ───────────────────────────────────────────────────

    def get_active_address(self) -> str:
        """Return the currently active Sui address."""
        data = self._sui(["active-address"])
        if isinstance(data, str):
            return data.strip()
        if isinstance(data, dict) and "result" in data:
            return data["result"]
        return str(data).strip()

    def get_object(self, object_id: str) -> dict:
        """Fetch on-chain object fields."""
        data = self._sui(["object", object_id])
        if not isinstance(data, dict):
            raise ChainError(f"Unexpected response type for object {object_id}: {type(data)}")
        return data

    def get_balance(self, coin_type: str = "0x2::sui::SUI") -> int:
        """Return total balance in MIST for the active address."""
        data = self._sui(["balance", "--coin-type", coin_type])
        if isinstance(data, list) and data:
            return int(data[0].get("totalBalance", 0))
        return 0

    def publish(self, move_dir: str | Path, gas_budget: int = 100_000_000) -> dict:
        """Publish a Move package and return the transaction result.

        On success, updates self.config with the package_id and saves to disk.
        The caller is responsible for extracting wiki_id / owner_cap_id from
        the returned object changes.
        """
        args = [
            "publish",
            str(move_dir),
            "--gas-budget",
            str(gas_budget),
        ]
        result = self._sui(args)
        if not isinstance(result, dict):
            raise ChainError(f"publish returned unexpected type: {type(result)}")

        # Extract package ID from objectChanges
        package_id = _extract_package_id(result)
        if package_id:
            self.config.package_id = package_id
            self.config.save()

        return result

    def call_move(
        self,
        module: str,
        function: str,
        type_args: list[str] | None = None,
        args: list[str] | None = None,
        gas_budget: int = 10_000_000,
    ) -> dict:
        """Call a Move function on the published package."""
        if not self.config.package_id:
            raise ChainError(
                "package_id not set in config. Run publish() first or update .cortex/config.json."
            )
        target = f"{self.config.package_id}::{module}::{function}"
        cmd_args = ["call", "--package", self.config.package_id,
                    "--module", module, "--function", function,
                    "--gas-budget", str(gas_budget)]
        if type_args:
            cmd_args += ["--type-args"] + type_args
        if args:
            cmd_args += ["--args"] + args
        return self._sui(cmd_args)  # type: ignore[return-value]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _extract_package_id(publish_result: dict) -> str:
    """Pull the package object ID out of a publish transaction result."""
    for change in publish_result.get("objectChanges", []):
        if change.get("type") == "published":
            return change.get("packageId", "")
    return ""
