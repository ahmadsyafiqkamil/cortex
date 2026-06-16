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
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

_CONFIG_PATH = Path(__file__).parent.parent / ".cortex" / "config.json"

# Keys owned by ChainConfig — excluded from the `extra` catch-all on load.
_KNOWN_KEYS = frozenset(
    {"network", "package_id", "wiki_id", "owner_cap_id", "agent_a", "agent_b", "gemini_model"}
)


class ChainError(RuntimeError):
    """Raised when a sui client call fails or returns unexpected output."""


@dataclass
class AgentIdentity:
    """Address + ContributorCap object ID for one agent keypair."""

    address: str = ""
    contributor_cap: str = ""

    @classmethod
    def from_dict(cls, data: dict) -> "AgentIdentity":
        return cls(
            address=data.get("address", ""),
            contributor_cap=data.get("contributor_cap", ""),
        )

    def to_dict(self) -> dict:
        return {"address": self.address, "contributor_cap": self.contributor_cap}


@dataclass
class ChainConfig:
    """Runtime config loaded from / saved to agent/.cortex/config.json.

    Schema mirrors docs/ARCHITECTURE.md §4.3:
        network, package_id, wiki_id, owner_cap_id,
        agent_a {address, contributor_cap},
        agent_b {address, contributor_cap},
        gemini_model
    """

    package_id: str = ""
    wiki_id: str = ""
    owner_cap_id: str = ""
    network: str = "testnet"
    agent_a: AgentIdentity = field(default_factory=AgentIdentity)
    agent_b: AgentIdentity = field(default_factory=AgentIdentity)
    gemini_model: str = ""
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
            agent_a=AgentIdentity.from_dict(data.get("agent_a") or {}),
            agent_b=AgentIdentity.from_dict(data.get("agent_b") or {}),
            gemini_model=data.get("gemini_model", ""),
            extra={k: v for k, v in data.items() if k not in _KNOWN_KEYS},
        )

    def save(self, path: Path = _CONFIG_PATH) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        data: dict = {
            "network": self.network,
            "package_id": self.package_id,
            "wiki_id": self.wiki_id,
            "owner_cap_id": self.owner_cap_id,
            "agent_a": self.agent_a.to_dict(),
            "agent_b": self.agent_b.to_dict(),
            "gemini_model": self.gemini_model,
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
        """Return total balance in MIST for the active address.

        sui client balance --json returns a nested structure:
          [ [ [metadata_dict, [coin_obj, ...]] ], false ]
        We sum the `balance` field of every coin object found.
        """
        data = self._sui(["balance", "--coin-type", coin_type])
        # Walk the nesting defensively; any non-list short-circuits to 0.
        try:
            # data[0] -> list of coin-type groups; data[0][0] -> first group
            # data[0][0][1] -> list of individual coin objects
            coin_objs = data[0][0][1]
            if isinstance(coin_objs, list):
                return sum(int(c.get("balance", 0)) for c in coin_objs if isinstance(c, dict))
        except (IndexError, TypeError, KeyError):
            pass
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
        cmd_args = ["call", "--package", self.config.package_id,
                    "--module", module, "--function", function,
                    "--gas-budget", str(gas_budget)]
        if type_args:
            cmd_args += ["--type-args"] + type_args
        if args:
            # Per-arg --args= form so values starting with "-" are not parsed as flags.
            cmd_args.extend(f"--args={arg}" for arg in args)
        return self._sui(cmd_args)  # type: ignore[return-value]

    # ── Move call helpers ────────────────────────────────────────────────────
    # Each wraps call_move() with the correct module/function/args for the
    # Cortex smart contracts. See wiki.move and source.move for signatures.
    #
    # Arg conventions (Sui CLI):
    #   - Object IDs:  passed as-is (e.g. "0xabc...")
    #   - Strings:     passed as bare values; the CLI wraps them in String
    #   - Clock:       always "0x6" (the Sui system clock shared object)
    #   - Vectors:     JSON array literal e.g. '["item1","item2"]'

    def register_source(
        self,
        blob: str,
        title: str,
        origin_url: str = "",
        agent: str = "a",
        gas_budget: int = 10_000_000,
    ) -> dict:
        """Call source::register_source with the specified agent's contributor cap.

        Args:
            blob: Walrus blob ID of the raw source file.
            title: Human-readable title for the source.
            origin_url: Optional origin URL (empty string for local files).
            agent: Which agent keypair to use ("a" or "b"). Default "a".
        """
        _, cap = self._agent_cap(agent)
        wiki = self.config.wiki_id
        if not wiki:
            raise ChainError("wiki_id missing from config.json")
        return self.call_move(
            module="source",
            function="register_source",
            args=[cap, wiki, blob, title, origin_url, "0x6"],
            gas_budget=gas_budget,
        )

    def add_page(
        self,
        slug: str,
        blob_id: str,
        sources_list: list[str],
        gas_budget: int = 10_000_000,
    ) -> dict:
        """Call wiki::add_page with Agent A's contributor cap.

        Args:
            slug: Canonical slug of the new page (lowercase-kebab).
            blob_id: Walrus blob ID of the page content.
            sources_list: Raw source blob IDs cited by this page.
        """
        cap = self.config.agent_a.contributor_cap
        wiki = self.config.wiki_id
        if not cap or not wiki:
            raise ChainError(
                "agent_a.contributor_cap or wiki_id missing from config.json"
            )
        sources_vec = _to_vec_arg(sources_list)
        return self.call_move(
            module="wiki",
            function="add_page",
            args=[cap, wiki, slug, blob_id, sources_vec, "0x6"],
            gas_budget=gas_budget,
        )

    def update_page(
        self,
        slug: str,
        new_blob_id: str,
        sources_list: list[str],
        gas_budget: int = 10_000_000,
    ) -> dict:
        """Call wiki::update_page with Agent A's contributor cap.

        Args:
            slug: Canonical slug of the existing page.
            new_blob_id: Walrus blob ID of the updated content.
            sources_list: Raw source blob IDs cited by the new version.
        """
        cap = self.config.agent_a.contributor_cap
        wiki = self.config.wiki_id
        if not cap or not wiki:
            raise ChainError(
                "agent_a.contributor_cap or wiki_id missing from config.json"
            )
        sources_vec = _to_vec_arg(sources_list)
        return self.call_move(
            module="wiki",
            function="update_page",
            args=[cap, wiki, slug, new_blob_id, sources_vec, "0x6"],
            gas_budget=gas_budget,
        )

    def add_link(
        self,
        from_slug: str,
        to_slug: str,
        gas_budget: int = 10_000_000,
    ) -> dict:
        """Call wiki::add_link (pure event, no Clock needed).

        Args:
            from_slug: The page slug that contains the wikilink.
            to_slug:   The page slug being linked to.
        """
        cap = self.config.agent_a.contributor_cap
        wiki = self.config.wiki_id
        if not cap or not wiki:
            raise ChainError(
                "agent_a.contributor_cap or wiki_id missing from config.json"
            )
        return self.call_move(
            module="wiki",
            function="add_link",
            args=[cap, wiki, from_slug, to_slug],
            gas_budget=gas_budget,
        )

    def _list_dynamic_fields(self) -> list[dict]:
        """Return raw entries from sui client dynamic-field for the wiki object.

        The actual output format (sui 1.73+) is:
            {"dynamicFields": [{fieldObject: {json: {name: "<slug>", value: {...}}}, ...}]}

        Returns the list of entry dicts, or [] on any error.
        """
        wiki_id = self.config.wiki_id
        if not wiki_id:
            raise ChainError("wiki_id missing from config.json")
        try:
            data = self._sui(["dynamic-field", wiki_id])
        except ChainError:
            return []
        if not isinstance(data, dict):
            return []
        entries = data.get("dynamicFields", [])
        return entries if isinstance(entries, list) else []

    def list_pages(self) -> list[str]:
        """Return all page slugs recorded in the wiki (reads dynamic fields on-chain).

        System pages (_index, _log) are included — callers filter as needed.
        """
        slugs: list[str] = []
        for entry in self._list_dynamic_fields():
            slug = _slug_from_entry(entry)
            if slug:
                slugs.append(slug)
        return slugs

    def get_page_record(self, slug: str) -> "dict | None":
        """Fetch the PageRecord for a slug from on-chain dynamic fields.

        Returns a dict with keys: latest_blob, history, sources,
        updated_at_ms, updated_by, deleted. Returns None if slug not found.
        """
        for entry in self._list_dynamic_fields():
            if _slug_from_entry(entry) == slug:
                return _record_from_entry(entry)
        return None

    def page_exists_onchain(self, slug: str) -> bool:
        """Check if a page slug already exists in the wiki object."""
        try:
            return slug in self.list_pages()
        except ChainError:
            return False

    # ── Source registry queries ─────────────────────────────────────────────

    def list_sources(self) -> list[dict]:
        """Return all registered source records.

        Each record is a dict with keys: blob, title, origin_url, added_by, added_at_ms.
        """
        sources: list[dict] = []
        for entry in self._list_dynamic_fields():
            name = _name_from_entry(entry)
            if name and name.startswith("src:"):
                record = _source_record_from_entry(entry)
                if record:
                    sources.append(record)
        return sources

    def get_all_page_blob_ids(self) -> set[str]:
        """Return all blob IDs used as page content (latest_blob + history)."""
        blob_ids: set[str] = set()
        for slug in self.list_pages():
            record = self.get_page_record(slug)
            if record:
                blob_ids.add(record.get("latest_blob", ""))
                for h in record.get("history", []) or []:
                    blob_ids.add(h)
        blob_ids.discard("")
        return blob_ids

    # ── Agent identity helpers ──────────────────────────────────────────────

    def _agent_cap(self, agent: str = "a") -> tuple[str, str]:
        """Return (address, contributor_cap) for the requested agent."""
        if agent == "a":
            identity = self.config.agent_a
        elif agent == "b":
            identity = self.config.agent_b
        else:
            raise ChainError(f"Unknown agent: {agent}")
        if not identity.contributor_cap or not identity.address:
            raise ChainError(f"agent_{agent} not configured in config.json")
        return identity.address, identity.contributor_cap

    # ── Dispute ─────────────────────────────────────────────────────────────

    def raise_dispute(
        self,
        page: str,
        reason_blob: str,
        agent: str = "b",
        gas_budget: int = 10_000_000,
    ) -> dict:
        """Call dispute::raise_dispute with the specified agent's contributor cap."""
        _, cap = self._agent_cap(agent)
        wiki = self.config.wiki_id
        if not wiki:
            raise ChainError("wiki_id missing from config.json")
        return self.call_move(
            module="dispute",
            function="raise_dispute",
            args=[cap, wiki, page, reason_blob],
            gas_budget=gas_budget,
        )

    def attest_provenance(
        self,
        page: str,
        page_blob: str,
        agent: str = "a",
        gas_budget: int = 10_000_000,
    ) -> dict:
        """Call attest::attest_provenance — open to any address, no cap required."""
        wiki = self.config.wiki_id
        if not wiki:
            raise ChainError("wiki_id missing from config.json")
        return self.call_move(
            module="attest",
            function="attest_provenance",
            args=[wiki, page, page_blob],
            gas_budget=gas_budget,
        )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _extract_package_id(publish_result: dict) -> str:
    """Pull the package object ID out of a publish transaction result."""
    for change in publish_result.get("objectChanges", []):
        if change.get("type") == "published":
            return change.get("packageId", "")
    return ""


def _slug_from_entry(entry: dict) -> str:
    """Extract the page slug from a dynamic-field list entry.

    sui 1.73 format: entry["fieldObject"]["json"]["name"] = "<slug>"
    Falls back to entry["name"]["value"] (some older variants).
    """
    try:
        slug = entry["fieldObject"]["json"]["name"]
        if isinstance(slug, str):
            return slug
    except (KeyError, TypeError):
        pass
    try:
        name = entry.get("name", {})
        if isinstance(name, dict):
            return name.get("value", "")
    except (AttributeError, TypeError):
        pass
    return ""


def _record_from_entry(entry: dict) -> "dict | None":
    """Extract PageRecord fields from a dynamic-field list entry.

    sui 1.73 format: entry["fieldObject"]["json"]["value"] = {latest_blob, ...}
    """
    try:
        fields = entry["fieldObject"]["json"]["value"]
        if isinstance(fields, dict) and "latest_blob" in fields:
            return {
                "latest_blob": fields.get("latest_blob", ""),
                "history": fields.get("history", []),
                "sources": fields.get("sources", []),
                "updated_at_ms": fields.get("updated_at_ms", 0),
                "updated_by": fields.get("updated_by", ""),
                "deleted": fields.get("deleted", False),
            }
    except (KeyError, TypeError):
        pass
    return None


def _name_from_entry(entry: dict) -> str:
    """Extract the dynamic field key name from an entry dict.

    Uses the same extraction logic as _slug_from_entry — the key is always
    a String stored in the fieldObject JSON name field.
    """
    try:
        name = entry["fieldObject"]["json"]["name"]
        if isinstance(name, str):
            return name
    except (KeyError, TypeError):
        pass
    try:
        name = entry.get("name", {})
        if isinstance(name, dict):
            return name.get("value", "")
    except (AttributeError, TypeError):
        pass
    return ""


def _source_record_from_entry(entry: dict) -> "dict | None":
    """Extract SourceRecord fields from a dynamic-field list entry.

    Returns a dict with keys: blob, title, origin_url, added_by, added_at_ms.
    """
    try:
        fields = entry["fieldObject"]["json"]["value"]
        if isinstance(fields, dict) and "blob" in fields:
            return {
                "blob": fields.get("blob", ""),
                "title": fields.get("title", ""),
                "origin_url": fields.get("origin_url", ""),
                "added_by": fields.get("added_by", ""),
                "added_at_ms": fields.get("added_at_ms", 0),
            }
    except (KeyError, TypeError):
        pass
    return None


def _to_vec_arg(items: list[str]) -> str:
    """Serialize a Python list to the Sui CLI vector argument format.

    The sui CLI expects vector<String> as a JSON array literal passed as a
    single command-line argument, e.g. '["blob_id_1","blob_id_2"]'.
    """
    escaped = ", ".join(f'"{item}"' for item in items)
    return f"[{escaped}]"
