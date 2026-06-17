"""Stateless RAG chat engine: retrieve -> select -> answer -> verify -> cite."""

from __future__ import annotations

import re
from pathlib import Path

from chat.catalog import build_catalog
from chat.citations import build_citations, verify_citations
from chat.history import format_history, trim_history
from chat.types import ChatError, ChatMessage, ChatResponse, PageRef

_REFUSAL = "That isn't in the Cortex knowledge base yet."


def _parse_prompt(template: str, variables: dict[str, str]) -> dict:
    for key, value in variables.items():
        template = template.replace("{{" + key + "}}", value)
    parts = re.split(r"^#\s*(system|user)\s*$", template, flags=re.MULTILINE | re.IGNORECASE)
    section: dict[str, str] = {}
    i = 1
    while i + 1 < len(parts):
        section[parts[i].strip().lower()] = parts[i + 1].strip()
        i += 2
    return {"prompt": section.get("user", template), "system": section.get("system")}


def _render_pages(pages: list[PageRef]) -> str:
    return "\n\n---\n\n".join(f"### [{p.slug}] {p.title}\n\n{p.content}" for p in pages)


class ChatEngine:
    def __init__(self, chain, walrus, llm, retriever, prompts_dir: Path, max_history: int = 6) -> None:
        self._chain = chain
        self._walrus = walrus
        self._llm = llm
        self._retriever = retriever
        self._answer_tmpl = (prompts_dir / "chat_answer.md").read_text(encoding="utf-8")
        self._max_history = max_history

    def respond(self, messages: list[ChatMessage]) -> ChatResponse:
        if not messages or messages[-1].role != "user" or not messages[-1].content.strip():
            raise ChatError("Last message must be a non-empty user message.")

        question = messages[-1].content.strip()
        history = trim_history(messages[:-1], self._max_history)

        try:
            catalog = build_catalog(self._chain, self._walrus)
        except Exception as exc:  # chain/walrus infra failure
            raise ChatError(f"Failed to build catalog: {exc}") from exc

        if not catalog:
            return ChatResponse(answer=_REFUSAL, citations=(), pages_used=(), refused=True)

        selected_slugs = self._retriever.find_relevant(question, history, catalog)
        if not selected_slugs:
            return ChatResponse(answer=_REFUSAL, citations=(), pages_used=(), refused=True)

        selected = [p for p in catalog if p.slug in set(selected_slugs)]

        parsed = _parse_prompt(
            self._answer_tmpl,
            {
                "QUESTION": question,
                "HISTORY": format_history(history) or "(none)",
                "PAGES": _render_pages(selected),
            },
        )
        try:
            raw_answer = self._llm.complete(parsed["prompt"], system=parsed["system"], temperature=0.2)
        except Exception as exc:
            raise ChatError(f"LLM answer failed: {exc}") from exc

        cleaned, used_slugs = verify_citations(raw_answer, {p.slug for p in selected})
        citations = build_citations(used_slugs, tuple(selected))
        return ChatResponse(
            answer=cleaned,
            citations=citations,
            pages_used=tuple(used_slugs),
            refused=False,
        )
