"""Unit tests for llm.client — the provider-agnostic LLM wrapper.

The only external boundary (the OpenAI-compatible HTTP client) is replaced with
a stub, so these tests make no network calls.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from llm.client import (
    LLMClient,
    LLMConfig,
    LLMConfigError,
    LLMResponseError,
)

pytestmark = pytest.mark.unit

CONFIG = LLMConfig(base_url="http://localhost:9999", api_key="test-key", model="test-model")


class _StubCompletions:
    """Stub for client.chat.completions with a recordable .create()."""

    def __init__(self, content: str | None):
        self._content = content
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        message = SimpleNamespace(content=self._content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])


def _client_returning(content: str | None) -> tuple[LLMClient, _StubCompletions]:
    """Build an LLMClient whose underlying OpenAI client is stubbed."""
    client = LLMClient(config=CONFIG)
    completions = _StubCompletions(content)
    client._client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    return client, completions


# --------------------------------------------------------------------------
# LLMConfig.from_env
# --------------------------------------------------------------------------

def test_from_env_raises_with_missing_vars_listed(monkeypatch):
    for var in ("LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"):
        monkeypatch.delenv(var, raising=False)

    with pytest.raises(LLMConfigError) as exc:
        LLMConfig.from_env()

    msg = str(exc.value)
    assert "LLM_BASE_URL" in msg
    assert "LLM_API_KEY" in msg
    assert "LLM_MODEL" in msg


def test_from_env_returns_config_when_all_present(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://x")
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setenv("LLM_MODEL", "m")

    cfg = LLMConfig.from_env()

    assert cfg == LLMConfig(base_url="http://x", api_key="k", model="m")


# --------------------------------------------------------------------------
# complete
# --------------------------------------------------------------------------

def test_complete_strips_think_block():
    client, _ = _client_returning("<think>chain of thought</think>real answer")

    result = client.complete("hi")

    assert result == "real answer"


def test_complete_raises_on_empty_content():
    client, _ = _client_returning("")

    with pytest.raises(LLMResponseError):
        client.complete("hi")


def test_complete_passes_system_message_when_provided():
    client, completions = _client_returning("ok")

    client.complete("user text", system="you are a bot")

    messages = completions.calls[0]["messages"]
    assert messages[0] == {"role": "system", "content": "you are a bot"}
    assert messages[-1] == {"role": "user", "content": "user text"}


# --------------------------------------------------------------------------
# complete_json
# --------------------------------------------------------------------------

def test_complete_json_strips_code_fences_and_parses():
    client, _ = _client_returning('```json\n{"a": 1, "b": "x"}\n```')

    data = client.complete_json("give json")

    assert data == {"a": 1, "b": "x"}


def test_complete_json_handles_think_then_fenced_json():
    client, _ = _client_returning('<think>reasoning</think>```json\n{"ok": true}\n```')

    data = client.complete_json("give json")

    assert data == {"ok": True}


def test_complete_json_raises_on_invalid_json():
    client, _ = _client_returning("not json at all")

    with pytest.raises(LLMResponseError):
        client.complete_json("give json")
