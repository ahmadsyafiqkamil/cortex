from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path


class WalrusError(Exception):
    """Raised when a walrus CLI operation fails."""


class WalrusClient:
    """Wrapper around the `walrus` CLI for Walrus blob storage on testnet.

    Blobs are cached locally at `.cortex/cache/<blob_id>` to avoid redundant
    network reads.
    """

    CONTEXT = "testnet"

    def __init__(self, cache_dir: Path | None = None):
        if cache_dir is None:
            cache_dir = Path.cwd() / ".cortex" / "cache"
        self._cache = cache_dir
        self._cache.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def store(self, file_path: Path) -> str:
        """Store a file on Walrus and return the blob_id.

        Walrus CLI does not support --json; we parse stdout + stderr defensively,
        handling multiple output formats across CLI versions.
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise WalrusError(f"File not found: {file_path}")

        cmd = ["walrus", "store", str(file_path), "--epochs", "max", "--context", self.CONTEXT]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        except FileNotFoundError:
            raise WalrusError("walrus CLI not found. Make sure it is installed and on your PATH.")

        if proc.returncode != 0:
            raise WalrusError(
                f"walrus command failed (exit {proc.returncode}):\n"
                f"  cmd   : {' '.join(cmd)}\n"
                f"  stderr: {proc.stderr.strip()}\n"
                f"  stdout: {proc.stdout.strip()}"
            )

        # Combine stdout + stderr: walrus 1.50+ writes summary to stdout and
        # INFO logs (which also contain blob_id) to stderr.
        combined = proc.stdout + "\n" + proc.stderr
        blob_id = self._parse_blob_id_from_store(combined)

        # Populate cache from the source file
        cached = self._cache / blob_id
        if not cached.exists():
            cached.write_bytes(file_path.read_bytes())

        return blob_id

    def read(self, blob_id: str) -> bytes:
        """Read a blob from Walrus (cache-first)."""
        cached = self._cache / blob_id
        if cached.exists():
            return cached.read_bytes()

        result = self._run(
            ["walrus", "read", blob_id, "--context", self.CONTEXT]
        )
        data = result.encode() if isinstance(result, str) else result
        cached.write_bytes(data)
        return data

    def store_text(self, content: str, name: str = "blob") -> str:
        """Write *content* to a temp file, store it, clean up, return blob_id."""
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".txt",
            prefix=f"cortex_{name}_",
            delete=False,
            encoding="utf-8",
        ) as fh:
            fh.write(content)
            tmp_path = Path(fh.name)

        try:
            blob_id = self.store(tmp_path)
        finally:
            tmp_path.unlink(missing_ok=True)

        # Also cache the text for quick re-read
        cached = self._cache / blob_id
        if not cached.exists():
            cached.write_text(content, encoding="utf-8")

        return blob_id

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _run(self, cmd: list[str]) -> str:
        """Run a CLI command and return stdout as a string, raising WalrusError on failure."""
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            raise WalrusError(
                "walrus CLI not found. Make sure it is installed and on your PATH."
            )

        if proc.returncode != 0:
            raise WalrusError(
                f"walrus command failed (exit {proc.returncode}):\n"
                f"  cmd : {' '.join(cmd)}\n"
                f"  stderr: {proc.stderr.strip()}\n"
                f"  stdout: {proc.stdout.strip()}"
            )

        return proc.stdout.strip()

    def _parse_blob_id_from_store(self, output: str) -> str:
        """Extract the blob_id from `walrus store` output.

        Walrus CLI has produced multiple output formats across versions:

        v1.50+ (human-readable summary on stdout):
            Blob ID: 6GktMlm_6qYqbVEJm_6rlSXCkPTQgGlXyUvAh43LWKE

        v1.50+ (INFO log on stderr):
            ... certified blob on Sui blob_id="6GktMlm_6qYqbVEJm_..."

        v1 (plain): the entire stdout is just the blob_id
        v2 (JSON envelope):
            {"newlyCreated": {"blobObject": {"blobId": "...", ...}}}
            {"alreadyExists": {"blobId": "..."}}
        """
        # Walrus 1.50+: "Blob ID: <id>" in stdout summary
        m = re.search(r"^Blob ID:\s*([A-Za-z0-9_\-]{10,})", output, re.MULTILINE)
        if m:
            return m.group(1)

        # Walrus 1.50+: blob_id="<id>" in INFO log stderr
        m = re.search(r'\bblob_id="([A-Za-z0-9_\-]{10,})"', output)
        if m:
            return m.group(1)

        # JSON envelope formats
        try:
            data = json.loads(output)
            blob_id = (
                data.get("newlyCreated", {}).get("blobObject", {}).get("blobId")
                or data.get("alreadyExists", {}).get("blobId")
                or data.get("blobId")
            )
            if blob_id:
                return blob_id
        except (json.JSONDecodeError, AttributeError):
            pass

        # JSON blobId key anywhere in output
        m = re.search(r'"blobId"\s*:\s*"([^"]+)"', output)
        if m:
            return m.group(1)

        # Last resort: entire output is the blob_id (plain alphanumeric string)
        stripped = output.strip().split()[0] if output.strip() else ""
        if re.fullmatch(r"[A-Za-z0-9_\-]{10,}", stripped):
            return stripped

        raise WalrusError(
            f"Could not extract blob_id from walrus store output:\n{output}"
        )
