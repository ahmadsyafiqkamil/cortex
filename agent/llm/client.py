"""Provider-agnostic LLM client.

Cortex never depends on a specific LLM vendor. Any OpenAI-compatible endpoint works:
point LLM_BASE_URL / LLM_API_KEY / LLM_MODEL at MiniMax, OpenAI, a Gemini-compatible
gateway, or a local server. Swapping providers is an env change, not a code change.

Hard rule (ARCHITECTURE.md §4.4): the LLM NEVER produces Walrus blob IDs. Callers inject
blob IDs into prompts/outputs programmatically. This module only does text in / text out.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass

from openai import OpenAI

# Defensive JSON extraction: strip ```json fences some models wrap output in.
_FENCE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)

# Reasoning models (e.g. MiniMax-M3) prepend a <think>...</think> block to the content.
# It's chain-of-thought, never the intended output, and it breaks JSON parsing.
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


class LLMConfigError(RuntimeError):
    """Raised when required LLM_* environment variables are missing."""


class LLMResponseError(RuntimeError):
    """Raised when the model output cannot be used (e.g. invalid JSON)."""


@dataclass(frozen=True)
class LLMConfig:
    base_url: str
    api_key: str
    model: str

    @classmethod
    def from_env(cls) -> "LLMConfig":
        base_url = os.environ.get("LLM_BASE_URL", "").strip()
        api_key = os.environ.get("LLM_API_KEY", "").strip()
        model = os.environ.get("LLM_MODEL", "").strip()
        missing = [
            name
            for name, value in (
                ("LLM_BASE_URL", base_url),
                ("LLM_API_KEY", api_key),
                ("LLM_MODEL", model),
            )
            if not value
        ]
        if missing:
            raise LLMConfigError(
                "Missing LLM env vars: "
                + ", ".join(missing)
                + ". Copy .env.example to .env and fill them in."
            )
        return cls(base_url=base_url, api_key=api_key, model=model)


class LLMClient:
    """Thin wrapper over an OpenAI-compatible chat endpoint."""

    def __init__(self, config: LLMConfig | None = None) -> None:
        self.config = config or LLMConfig.from_env()
        self._client = OpenAI(base_url=self.config.base_url, api_key=self.config.api_key)

    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.2,
        json_out: bool = False,
    ) -> str:
        """Return the model's text response.

        temperature defaults low — extraction/writing favor determinism over creativity.
        """
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        kwargs: dict = {
            "model": self.config.model,
            "messages": messages,
            "temperature": temperature,
        }
        # Best-effort JSON mode. Not all providers support response_format; fall back
        # to plain text + defensive parsing in complete_json() if it errors.
        if json_out:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            resp = self._client.chat.completions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001 — surface provider errors with context
            if json_out:
                kwargs.pop("response_format", None)
                resp = self._client.chat.completions.create(**kwargs)
            else:
                raise LLMResponseError(f"LLM request failed: {exc}") from exc

        content = resp.choices[0].message.content or ""
        # Drop chain-of-thought so callers get only the intended output.
        content = _THINK.sub("", content).strip()
        if not content:
            raise LLMResponseError("LLM returned empty content.")
        return content

    def complete_json(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.0,
    ) -> dict:
        """Return parsed JSON. Strips code fences and validates with a clear error."""
        raw = self.complete(prompt, system=system, temperature=temperature, json_out=True)
        cleaned = _FENCE.sub("", raw).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise LLMResponseError(
                f"LLM did not return valid JSON: {exc}. First 200 chars: {cleaned[:200]!r}"
            ) from exc
