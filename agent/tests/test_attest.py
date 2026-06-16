"""Unit tests for ChainClient.attest_provenance — subprocess is monkeypatched."""

from __future__ import annotations

import json
import subprocess
from types import SimpleNamespace
from unittest import mock

import pytest

from chain.client import ChainClient, ChainError, ChainConfig

pytestmark = pytest.mark.unit

WIKI_ID = "0xd55c7cc26ccad850e2b549a5ec88db8983ea732823fc0c60849b1f7891f86755"
PACKAGE_ID = "0x823f71d5795240a23e6ae2e7ca195faf93b3a55782f7b3a143f40babc8bf3b7e"
AGENT_A = "0x6034727b72070c008e8d947d0289915e92fa77630b39d4d7d6fc61fadf0e3e89"
AGENT_B = "0x50126de47be4156ab355685b76eb2fabe94908ea4350fd192727c3c710eeb86a"


def _make_config(**overrides) -> ChainConfig:
    """Build a minimal ChainConfig for testing."""
    d = {
        "network": "testnet",
        "package_id": PACKAGE_ID,
        "wiki_id": WIKI_ID,
        "owner_cap_id": "0x1",
        "agent_a": {
            "address": AGENT_A,
            "contributor_cap": "0x2",
        },
        "agent_b": {
            "address": AGENT_B,
            "contributor_cap": "0x3",
        },
    }
    d.update(overrides)
    return ChainConfig(**d)


def test_attest_provenance_success():
    """attest_provenance calls the Move function and returns the result dict."""
    config = _make_config()
    client = ChainClient(config)

    mock_result = {
        "digest": "0xabc123",
        "objectChanges": [
            {"type": "created", "objectId": "0xattest123", "objectType": "cortex::attest::ProvenanceAttestation"},
        ],
    }

    with mock.patch.object(client, "call_move", return_value=mock_result) as mock_call:
        result = client.attest_provenance(
            page="some-page",
            page_blob="blob_XYZ",
        )

    mock_call.assert_called_once_with(
        module="attest",
        function="attest_provenance",
        args=[WIKI_ID, "some-page", "blob_XYZ"],
        gas_budget=10_000_000,
    )
    assert result == mock_result


def test_attest_provenance_missing_wiki():
    """attest_provenance raises ChainError when wiki_id is missing."""
    config = _make_config(wiki_id="")
    client = ChainClient(config)

    with pytest.raises(ChainError, match="wiki_id missing"):
        client.attest_provenance(page="x", page_blob="y")
