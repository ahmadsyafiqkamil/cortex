"""Retrieval layer for the chat engine.

`Retriever` is the seam: FullCatalogRetriever ships now; an EmbeddingRetriever
(vectors, possibly stored on Walrus) can swap in later without touching engine.py.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Protocol

from chat.history import format_history
from chat.types import ChatMessage, PageRef


class Retriever(Protocol):
    def find_relevant(
        self, question: str, history: list[ChatMessage], catalog: tuple[PageRef, ...]
    ) -> list[str]:
        ...


def _render_catalog(catalog: tuple[PageRef, ...]) -> str:
    return "\n".join(f"- {p.slug} | {p.title} — {p.summary}" for p in catalog)


def _parse_prompt(template: str, variables: dict[str, str]) -> dict:
    """Split a '# system / # user' template and substitute {{VAR}} placeholders."""
    for key, value in variables.items():
        template = template.replace("{{" + key + "}}", value)
    parts = re.split(r"^#\s*(system|user)\s*$", template, flags=re.MULTILINE | re.IGNORECASE)
    section: dict[str, str] = {}
    i = 1
    while i + 1 < len(parts):
        section[parts[i].strip().lower()] = parts[i + 1].strip()
        i += 2
    return {"prompt": section.get("user", template), "system": section.get("system")}


class FullCatalogRetriever:
    """Feed the whole catalog to the LLM and let it pick relevant slugs by meaning."""

    def __init__(self, llm, prompts_dir: Path) -> None:
        self._llm = llm
        self._template = (prompts_dir / "chat_select.md").read_text(encoding="utf-8")

    def find_relevant(
        self, question: str, history: list[ChatMessage], catalog: tuple[PageRef, ...]
    ) -> list[str]:
        if not catalog:
            return []
        parsed = _parse_prompt(
            self._template,
            {
                "QUESTION": question,
                "HISTORY": format_history(history) or "(none)",
                "CATALOG": _render_catalog(catalog),
            },
        )
        data = self._llm.complete_json(parsed["prompt"], system=parsed["system"], temperature=0.0)
        raw = data.get("relevant_slugs", []) if isinstance(data, dict) else []
        valid = {p.slug for p in catalog}
        seen: set[str] = set()
        out: list[str] = []
        for slug in raw:
            if isinstance(slug, str) and slug in valid and slug not in seen:
                seen.add(slug)
                out.append(slug)
        return out
