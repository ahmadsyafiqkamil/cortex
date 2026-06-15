"""Unit tests for walrus.client — the Walrus CLI wrapper.

The CLI boundary (`subprocess.run`) is monkeypatched and the cache lives under
pytest's tmp_path, so these tests touch neither the network nor a real walrus binary.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from walrus.client import WalrusClient, WalrusError

pytestmark = pytest.mark.unit

BLOB = "6GktMlm_6qYqbVEJm_6rlSXCkPTQgGlXyUvAh43LWKE"


@pytest.fixture
def client(tmp_path):
    return WalrusClient(cache_dir=tmp_path / "cache")


# --------------------------------------------------------------------------
# _parse_blob_id_from_store — the defensive multi-format parser
# --------------------------------------------------------------------------

def test_parse_human_readable_summary(client):
    out = f"Successfully stored.\nBlob ID: {BLOB}\nCost: 1 WAL"
    assert client._parse_blob_id_from_store(out) == BLOB


def test_parse_stderr_info_log(client):
    out = f'INFO certified blob on Sui blob_id="{BLOB}" epoch=42'
    assert client._parse_blob_id_from_store(out) == BLOB


def test_parse_json_newly_created(client):
    out = f'{{"newlyCreated": {{"blobObject": {{"blobId": "{BLOB}"}}}}}}'
    assert client._parse_blob_id_from_store(out) == BLOB


def test_parse_json_already_exists(client):
    out = f'{{"alreadyExists": {{"blobId": "{BLOB}"}}}}'
    assert client._parse_blob_id_from_store(out) == BLOB


def test_parse_json_bare_blob_id(client):
    out = f'{{"blobId": "{BLOB}"}}'
    assert client._parse_blob_id_from_store(out) == BLOB


def test_parse_plain_output(client):
    assert client._parse_blob_id_from_store(BLOB) == BLOB


def test_parse_unrecognized_raises(client):
    with pytest.raises(WalrusError):
        client._parse_blob_id_from_store("???")


# --------------------------------------------------------------------------
# store
# --------------------------------------------------------------------------

def test_store_returns_blob_id_and_populates_cache(client, tmp_path, monkeypatch):
    src = tmp_path / "source.txt"
    src.write_text("hello cortex", encoding="utf-8")

    def fake_run(cmd, **kwargs):
        return SimpleNamespace(returncode=0, stdout=f"Blob ID: {BLOB}", stderr="")

    monkeypatch.setattr("walrus.client.subprocess.run", fake_run)

    blob_id = client.store(src)

    assert blob_id == BLOB
    assert (client._cache / BLOB).read_bytes() == b"hello cortex"


def test_store_missing_file_raises(client, tmp_path):
    with pytest.raises(WalrusError):
        client.store(tmp_path / "does-not-exist.txt")


def test_store_nonzero_exit_raises(client, tmp_path, monkeypatch):
    src = tmp_path / "source.txt"
    src.write_text("x", encoding="utf-8")

    def fake_run(cmd, **kwargs):
        return SimpleNamespace(returncode=1, stdout="", stderr="insufficient WAL")

    monkeypatch.setattr("walrus.client.subprocess.run", fake_run)

    with pytest.raises(WalrusError):
        client.store(src)


# --------------------------------------------------------------------------
# read
# --------------------------------------------------------------------------

def test_read_uses_cache_without_invoking_cli(client, monkeypatch):
    (client._cache / BLOB).write_bytes(b"cached bytes")

    def boom(*args, **kwargs):  # must never be called on a cache hit
        raise AssertionError("subprocess.run should not run on cache hit")

    monkeypatch.setattr("walrus.client.subprocess.run", boom)

    assert client.read(BLOB) == b"cached bytes"
