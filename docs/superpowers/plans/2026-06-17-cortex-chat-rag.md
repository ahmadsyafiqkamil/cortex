# Cortex Chat (RAG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-turn chatbot that answers questions from the Cortex wiki via RAG, with code-verified per-claim provenance citations, exposed as a CLI command (`cortex chat`), a Flask endpoint (`POST /api/chat`), and a web page ("Ask Cortex").

**Architecture:** One stateless RAG engine in `agent/chat/` shared by all frontends. Per turn: build a full-page catalog from Walrus → MiniMax selects relevant pages → fetch their content (already in catalog) → MiniMax answers with `[[slug]]` claim tags + conversation history → code verifies tags and injects real blob IDs. Retrieval lives behind a `Retriever` protocol so embeddings can swap in later.

**Tech Stack:** Python 3.11, typer (CLI), Flask (API), pytest (tests), React+Vite+TypeScript (web). Reuses existing `ChainClient`, `WalrusClient`, `LLMClient`, and `cortex_cli.pageformat`.

**Spec:** `docs/superpowers/specs/2026-06-17-cortex-chat-rag-design.md`

**Conventions (from existing code):**
- Commands run from the `agent/` directory (`cd agent && python -m cortex_cli ...`, `cd agent && pytest`).
- Prompt templates use `# system` / `# user` sections with `{{VAR}}` placeholders; parse with `_parse_prompt` (already in `__main__.py`).
- HARD RULE: the LLM never produces blob IDs — code injects them.

---

## Phase 1 — Core engine (`agent/chat/`)

### Task 1: Package skeleton + types

**Files:**
- Create: `agent/chat/__init__.py`
- Create: `agent/chat/types.py`
- Test: `agent/tests/test_chat_types.py`

- [ ] **Step 1: Write the failing test**

```python
# agent/tests/test_chat_types.py
import dataclasses
import pytest
from chat.types import ChatMessage, PageRef, Citation, ChatResponse, ChatError


def test_types_are_frozen():
    msg = ChatMessage(role="user", content="hi")
    with pytest.raises(dataclasses.FrozenInstanceError):
        msg.content = "x"  # type: ignore[misc]


def test_chat_response_defaults():
    resp = ChatResponse(answer="a", citations=(), pages_used=(), refused=False)
    assert resp.refused is False
    assert resp.citations == ()


def test_chat_error_is_runtimeerror():
    assert issubclass(ChatError, RuntimeError)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && python -m pytest tests/test_chat_types.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'chat'`

- [ ] **Step 3: Write minimal implementation**

```python
# agent/chat/__init__.py
"""Cortex chat (RAG) engine — stateless conversational search over the wiki."""
```

```python
# agent/chat/types.py
"""Frozen data contracts for the Cortex chat engine."""

from __future__ import annotations

from dataclasses import dataclass


class ChatError(RuntimeError):
    """Raised on infrastructure failures (chain/LLM config) the caller must surface."""


@dataclass(frozen=True)
class ChatMessage:
    role: str          # "user" | "assistant"
    content: str


@dataclass(frozen=True)
class PageRef:
    slug: str
    title: str
    summary: str       # one-line summary for the selection catalog
    content: str       # full page markdown (reused for the answer step)
    page_blob_id: str  # PageRecord.latest_blob


@dataclass(frozen=True)
class Citation:
    slug: str
    page_blob_id: str
    source_blob_id: str   # raw source blob — the real provenance anchor
    source_title: str


@dataclass(frozen=True)
class ChatResponse:
    answer: str
    citations: tuple[Citation, ...]
    pages_used: tuple[str, ...]
    refused: bool
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && python -m pytest tests/test_chat_types.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add agent/chat/__init__.py agent/chat/types.py agent/tests/test_chat_types.py
git commit -m "feat(chat): add chat engine package skeleton and frozen types"
```

---

### Task 2: Catalog builder (`agent/chat/catalog.py`)

Reads every non-system page once from Walrus and returns `PageRef`s carrying full
content (so the answer step needs no second read).

**Files:**
- Create: `agent/chat/catalog.py`
- Test: `agent/tests/test_chat_catalog.py`

- [ ] **Step 1: Write the failing test**

```python
# agent/tests/test_chat_catalog.py
from chat.catalog import build_catalog, SYSTEM_SLUGS


class FakeChain:
    def __init__(self, pages):  # pages: dict[slug] -> record
        self._pages = pages

    def list_pages(self):
        return list(self._pages.keys())

    def get_page_record(self, slug):
        return self._pages.get(slug)


class FakeWalrus:
    def __init__(self, blobs):  # blobs: dict[blob_id] -> str
        self._blobs = blobs

    def read(self, blob_id):
        return self._blobs[blob_id].encode("utf-8")


PAGE_MD = (
    "---\ntitle: Lost Passport Abroad\nslug: lost-passport\n---\n\n"
    "Report to the embassy first. ^[blob:RAW1]\n"
)


def test_build_catalog_skips_system_and_deleted():
    chain = FakeChain({
        "_index": {"latest_blob": "B0", "deleted": False},
        "lost-passport": {"latest_blob": "B1", "deleted": False, "sources": []},
        "old-page": {"latest_blob": "B2", "deleted": True, "sources": []},
    })
    walrus = FakeWalrus({"B0": "x", "B1": PAGE_MD, "B2": "y"})

    catalog = build_catalog(chain, walrus)

    slugs = [p.slug for p in catalog]
    assert slugs == ["lost-passport"]
    page = catalog[0]
    assert page.title == "Lost Passport Abroad"
    assert page.page_blob_id == "B1"
    assert "embassy" in page.summary
    assert page.content == PAGE_MD


def test_build_catalog_skips_unreadable_pages():
    chain = FakeChain({"p1": {"latest_blob": "MISSING", "deleted": False, "sources": []}})

    class BrokenWalrus:
        def read(self, blob_id):
            raise RuntimeError("walrus down")

    catalog = build_catalog(chain, BrokenWalrus())
    assert catalog == ()


def test_system_slugs_constant():
    assert "_index" in SYSTEM_SLUGS and "_log" in SYSTEM_SLUGS
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && python -m pytest tests/test_chat_catalog.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'chat.catalog'`

- [ ] **Step 3: Write minimal implementation**

```python
# agent/chat/catalog.py
"""Build the page catalog the chat engine retrieves over.

Reads every non-system page once and keeps the full markdown on the PageRef so
the answer step does not re-read Walrus.
"""

from __future__ import annotations

from cortex_cli.pageformat import body_without_frontmatter, parse_frontmatter

from chat.types import PageRef

SYSTEM_SLUGS = frozenset({"_index", "_log"})

_SUMMARY_MAX = 160


def _first_line(md: str) -> str:
    for line in body_without_frontmatter(md).splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            return line[:_SUMMARY_MAX]
    return ""


def build_catalog(chain, walrus) -> tuple[PageRef, ...]:
    """Return PageRefs for all live, readable, non-system pages.

    Unreadable pages are skipped, never raised — a single bad blob must not break
    the whole catalog.
    """
    refs: list[PageRef] = []
    for slug in chain.list_pages():
        if slug in SYSTEM_SLUGS:
            continue
        record = chain.get_page_record(slug)
        if not record or record.get("deleted"):
            continue
        blob_id = record.get("latest_blob", "")
        if not blob_id:
            continue
        try:
            md = walrus.read(blob_id).decode("utf-8", errors="replace")
        except Exception:
            continue
        fm = parse_frontmatter(md)
        refs.append(
            PageRef(
                slug=slug,
                title=fm.get("title", slug) or slug,
                summary=_first_line(md),
                content=md,
                page_blob_id=blob_id,
            )
        )
    return tuple(refs)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && python -m pytest tests/test_chat_catalog.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add agent/chat/catalog.py agent/tests/test_chat_catalog.py
git commit -m "feat(chat): add page catalog builder"
```

---

### Task 3: Citation verification (`agent/chat/citations.py`) — Layer 3

Parses `[[slug]]` claim tags from the model's answer, flags any slug that was not
fed (replaces with `[unverified]`), and builds `Citation`s with real blob IDs.

**Files:**
- Create: `agent/chat/citations.py`
- Test: `agent/tests/test_chat_citations.py`

- [ ] **Step 1: Write the failing test**

```python
# agent/tests/test_chat_citations.py
from chat.citations import verify_citations, build_citations
from chat.types import PageRef

PAGE_MD = (
    "---\ntitle: Lost Passport\nslug: lost-passport\n"
    "sources:\n  - blob: RAW1\n    title: Permenlu 5/2018\n---\n\n"
    "Report to the embassy. ^[blob:RAW1]\n"
)
PAGE = PageRef(
    slug="lost-passport", title="Lost Passport", summary="Report to the embassy.",
    content=PAGE_MD, page_blob_id="PAGEBLOB1",
)


def test_verify_keeps_valid_tags_and_collects_used_slugs():
    answer = "Go to the embassy [[lost-passport]]."
    cleaned, used = verify_citations(answer, {"lost-passport"})
    assert "[[lost-passport]]" in cleaned
    assert used == ["lost-passport"]


def test_verify_flags_unfed_slug():
    answer = "You can sue them [[made-up-page]]."
    cleaned, used = verify_citations(answer, {"lost-passport"})
    assert "[[made-up-page]]" not in cleaned
    assert "[unverified]" in cleaned
    assert used == []


def test_verify_dedups_used_slugs_in_order():
    answer = "A [[lost-passport]]. B [[lost-passport]]."
    _, used = verify_citations(answer, {"lost-passport"})
    assert used == ["lost-passport"]


def test_build_citations_injects_real_blob_ids():
    cites = build_citations(["lost-passport"], (PAGE,))
    assert len(cites) == 1
    c = cites[0]
    assert c.slug == "lost-passport"
    assert c.page_blob_id == "PAGEBLOB1"
    assert c.source_blob_id == "RAW1"
    assert c.source_title == "Permenlu 5/2018"


def test_build_citations_ignores_unused_slugs():
    cites = build_citations([], (PAGE,))
    assert cites == ()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && python -m pytest tests/test_chat_citations.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'chat.citations'`

- [ ] **Step 3: Write minimal implementation**

```python
# agent/chat/citations.py
"""Layer-3 anti-hallucination: verify per-claim [[slug]] tags and inject blob IDs.

The model tags each claim with [[slug]]. We trust nothing it writes about blob IDs.
This module validates each tag against the pages actually fed, flags fabricated
attributions, and attaches real blob IDs derived from page content.
"""

from __future__ import annotations

import re

from cortex_cli.pageformat import extract_markers, parse_frontmatter, resolve_source_title

from chat.types import Citation, PageRef

_TAG_RE = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")
_UNVERIFIED = "[unverified]"


def verify_citations(answer: str, fed_slugs: set[str]) -> tuple[str, list[str]]:
    """Validate [[slug]] tags in the answer against the pages that were fed.

    Returns (cleaned_answer, used_slugs):
      - tags whose slug was fed are kept; the slug is recorded in used_slugs
        (deduped, in first-seen order)
      - tags whose slug was NOT fed are replaced with "[unverified]"
    """
    used: list[str] = []

    def _replace(match: re.Match) -> str:
        slug = match.group(1).strip()
        if slug in fed_slugs:
            if slug not in used:
                used.append(slug)
            return match.group(0)
        return _UNVERIFIED

    cleaned = _TAG_RE.sub(_replace, answer)
    return cleaned, used


def build_citations(used_slugs: list[str], pages: tuple[PageRef, ...]) -> tuple[Citation, ...]:
    """Build Citations (with real blob IDs) for the pages actually cited.

    Dedups by source_blob_id so a raw source shared by two pages appears once.
    """
    by_slug = {p.slug: p for p in pages}
    citations: list[Citation] = []
    seen: set[str] = set()
    for slug in used_slugs:
        page = by_slug.get(slug)
        if not page:
            continue
        fm = parse_frontmatter(page.content)
        for blob_id in extract_markers(page.content):
            if blob_id in seen:
                continue
            seen.add(blob_id)
            citations.append(
                Citation(
                    slug=slug,
                    page_blob_id=page.page_blob_id,
                    source_blob_id=blob_id,
                    source_title=resolve_source_title(blob_id, fm),
                )
            )
    return tuple(citations)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && python -m pytest tests/test_chat_citations.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add agent/chat/citations.py agent/tests/test_chat_citations.py
git commit -m "feat(chat): add Layer-3 citation verification and blob-ID injection"
```

---

### Task 4: History helpers (`agent/chat/history.py`)

(Defined before the retriever because the retriever imports `format_history`.)

**Files:**
- Create: `agent/chat/history.py`
- Test: `agent/tests/test_chat_history.py`

- [ ] **Step 1: Write the failing test**

```python
# agent/tests/test_chat_history.py
from chat.history import format_history, trim_history
from chat.types import ChatMessage


def test_format_history_labels_roles():
    msgs = [ChatMessage("user", "hi"), ChatMessage("assistant", "hello")]
    out = format_history(msgs)
    assert "User: hi" in out
    assert "Assistant: hello" in out


def test_format_history_empty():
    assert format_history([]) == ""


def test_trim_history_keeps_last_n():
    msgs = [ChatMessage("user", str(i)) for i in range(10)]
    trimmed = trim_history(msgs, max_messages=4)
    assert [m.content for m in trimmed] == ["6", "7", "8", "9"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && python -m pytest tests/test_chat_history.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'chat.history'`

- [ ] **Step 3: Write minimal implementation**

```python
# agent/chat/history.py
"""Conversation history helpers — formatting for prompts and bounded trimming."""

from __future__ import annotations

from chat.types import ChatMessage

_LABELS = {"user": "User", "assistant": "Assistant"}


def format_history(messages: list[ChatMessage]) -> str:
    return "\n".join(f"{_LABELS.get(m.role, m.role)}: {m.content}" for m in messages)


def trim_history(messages: list[ChatMessage], max_messages: int = 6) -> list[ChatMessage]:
    """Keep only the most recent messages to bound prompt size."""
    if max_messages <= 0:
        return []
    return messages[-max_messages:]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && python -m pytest tests/test_chat_history.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add agent/chat/history.py agent/tests/test_chat_history.py
git commit -m "feat(chat): add conversation history helpers"
```

---

### Task 5: Selection prompt + retriever (`agent/chat/retriever.py`)

**Files:**
- Create: `agent/llm/prompts/chat_select.md`
- Create: `agent/chat/retriever.py`
- Test: `agent/tests/test_chat_retriever.py`

- [ ] **Step 1: Create the selection prompt template**

```markdown
# system
You are the retrieval planner for Cortex, a curated wiki. Given a user question and a catalog of available pages (slug, title, summary), choose ONLY the pages whose content is genuinely relevant to answering the question. Match by meaning, not exact words. If none are relevant, return an empty list. Never invent slugs that are not in the catalog.

# user
Conversation so far:
{{HISTORY}}

Current question: {{QUESTION}}

Available pages:
{{CATALOG}}

Return JSON exactly in this shape, with no prose:
{"relevant_slugs": ["slug-a", "slug-b"]}
```

- [ ] **Step 2: Write the failing test**

```python
# agent/tests/test_chat_retriever.py
from chat.retriever import FullCatalogRetriever
from chat.types import ChatMessage, PageRef

CATALOG = (
    PageRef("lost-passport", "Lost Passport", "Report to embassy.", "md", "B1"),
    PageRef("visa-renewal", "Visa Renewal", "How to renew.", "md", "B2"),
)


class FakeLLM:
    def __init__(self, payload):
        self._payload = payload
        self.last_prompt = None
        self.last_system = None

    def complete_json(self, prompt, system=None, temperature=0.0):
        self.last_prompt = prompt
        self.last_system = system
        return self._payload


def _prompts_dir():
    from pathlib import Path
    return Path(__file__).parent.parent / "llm" / "prompts"


def test_retriever_returns_only_catalog_slugs():
    llm = FakeLLM({"relevant_slugs": ["lost-passport", "ghost-page"]})
    r = FullCatalogRetriever(llm, _prompts_dir())
    out = r.find_relevant("passport lost", [], CATALOG)
    assert out == ["lost-passport"]  # ghost-page filtered out


def test_retriever_empty_on_no_match():
    llm = FakeLLM({"relevant_slugs": []})
    r = FullCatalogRetriever(llm, _prompts_dir())
    assert r.find_relevant("unrelated", [], CATALOG) == []


def test_retriever_passes_history_into_prompt():
    llm = FakeLLM({"relevant_slugs": []})
    r = FullCatalogRetriever(llm, _prompts_dir())
    r.find_relevant("more detail", [ChatMessage("user", "passport?")], CATALOG)
    assert "passport?" in llm.last_prompt
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd agent && python -m pytest tests/test_chat_retriever.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'chat.retriever'`

- [ ] **Step 4: Write minimal implementation**

```python
# agent/chat/retriever.py
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd agent && python -m pytest tests/test_chat_retriever.py -v`
Expected: PASS (3 passed)

- [ ] **Step 6: Commit**

```bash
git add agent/llm/prompts/chat_select.md agent/chat/retriever.py agent/tests/test_chat_retriever.py
git commit -m "feat(chat): add selection prompt and FullCatalogRetriever"
```

---

### Task 6: Answer prompt + engine (`agent/chat/engine.py`)

**Files:**
- Create: `agent/llm/prompts/chat_answer.md`
- Create: `agent/chat/engine.py`
- Test: `agent/tests/test_chat_engine.py`

- [ ] **Step 1: Create the answer prompt template**

```markdown
# system
You are Cortex, a knowledge assistant. Answer using ONLY the wiki pages provided. Do not invent facts. After each factual claim, attribute it with the page slug in double brackets, e.g. [[lost-passport]]. Use the conversation history to resolve references like "that" or "it". Never write blob IDs — the system attaches them.

# user
Conversation so far:
{{HISTORY}}

Current question: {{QUESTION}}

Wiki pages:
{{PAGES}}

Instructions:
- Answer concisely in 1-3 paragraphs.
- After every factual claim, add the source page tag like [[slug-name]].
- Only use slugs that appear in the wiki pages above.
- If the pages do not contain enough information, say so plainly — do not guess.
```

- [ ] **Step 2: Write the failing test**

```python
# agent/tests/test_chat_engine.py
from chat.engine import ChatEngine
from chat.types import ChatMessage, PageRef

PAGE_MD = (
    "---\ntitle: Lost Passport\nslug: lost-passport\n"
    "sources:\n  - blob: RAW1\n    title: Permenlu 5/2018\n---\n\n"
    "Report to the embassy. ^[blob:RAW1]\n"
)


class FakeChain:
    def list_pages(self):
        return ["_index", "lost-passport"]

    def get_page_record(self, slug):
        if slug == "lost-passport":
            return {"latest_blob": "B1", "deleted": False, "sources": []}
        return {"latest_blob": "B0", "deleted": False}


class FakeWalrus:
    def read(self, blob_id):
        return {"B0": "idx", "B1": PAGE_MD}[blob_id].encode()


class FakeRetriever:
    def __init__(self, slugs):
        self._slugs = slugs

    def find_relevant(self, question, history, catalog):
        return list(self._slugs)


class FakeLLM:
    def __init__(self, answer):
        self._answer = answer

    def complete(self, prompt, system=None, temperature=0.2):
        return self._answer


def _prompts_dir():
    from pathlib import Path
    return Path(__file__).parent.parent / "llm" / "prompts"


def _engine(retriever, llm):
    return ChatEngine(
        chain=FakeChain(), walrus=FakeWalrus(), llm=llm,
        retriever=retriever, prompts_dir=_prompts_dir(),
    )


def test_engine_answers_with_verified_citations():
    eng = _engine(FakeRetriever(["lost-passport"]),
                  FakeLLM("Go to the embassy [[lost-passport]]."))
    resp = eng.respond([ChatMessage("user", "I lost my passport")])
    assert resp.refused is False
    assert resp.pages_used == ("lost-passport",)
    assert resp.citations[0].source_blob_id == "RAW1"
    assert "[[lost-passport]]" in resp.answer


def test_engine_refuses_when_no_relevant_page():
    eng = _engine(FakeRetriever([]), FakeLLM("should not be called"))
    resp = eng.respond([ChatMessage("user", "unrelated question")])
    assert resp.refused is True
    assert resp.citations == ()


def test_engine_flags_fabricated_slug():
    eng = _engine(FakeRetriever(["lost-passport"]),
                  FakeLLM("You can sue [[fake-page]]."))
    resp = eng.respond([ChatMessage("user", "options?")])
    assert "[unverified]" in resp.answer
    assert resp.pages_used == ()
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd agent && python -m pytest tests/test_chat_engine.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'chat.engine'`

- [ ] **Step 4: Write minimal implementation**

```python
# agent/chat/engine.py
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd agent && python -m pytest tests/test_chat_engine.py -v`
Expected: PASS (3 passed)

- [ ] **Step 6: Run the whole chat suite + commit**

Run: `cd agent && python -m pytest tests/test_chat_*.py -v`
Expected: PASS (all chat tests)

```bash
git add agent/llm/prompts/chat_answer.md agent/chat/engine.py agent/tests/test_chat_engine.py
git commit -m "feat(chat): add answer prompt and stateless RAG ChatEngine"
```

---

## Phase 2 — CLI (`cortex chat`)

### Task 7: `cortex chat` REPL command

**Files:**
- Modify: `agent/cortex_cli/__main__.py` (add a new command; place after the `query` command, before the `# ── trace ──` separator ~line 413)
- Test: manual (REPL needs a live provider + chain)

- [ ] **Step 1: Add imports to both import branches**

In `agent/cortex_cli/__main__.py`, add to the package import block (the `try:` branch, alongside `from chain import ChainClient, ChainError`, ~line 39):

```python
from chat.engine import ChatEngine
from chat.retriever import FullCatalogRetriever
from chat.types import ChatError, ChatMessage
```

And to the `except ImportError:` fallback branch (alongside `from agent.chain import ChainClient, ChainError`, ~line 52):

```python
from agent.chat.engine import ChatEngine  # type: ignore
from agent.chat.retriever import FullCatalogRetriever  # type: ignore
from agent.chat.types import ChatError, ChatMessage  # type: ignore
```

- [ ] **Step 2: Add the command (insert before the `# ── trace ──` separator, ~line 413)**

```python
# ── chat ─────────────────────────────────────────────────────────────────────

@app.command("chat")
def chat() -> None:
    """Multi-turn chat over the wiki with verifiable provenance citations.

    Type a question; Ctrl-D (or 'exit') quits. Conversation history is kept in
    memory for the session only — the engine itself is stateless.
    """
    try:
        llm_config = LLMConfig.from_env()
    except LLMConfigError as exc:
        rprint(f"[red]LLM config error:[/red] {exc}")
        raise typer.Exit(code=1)

    llm = LLMClient(llm_config)
    chain = ChainClient()
    walrus = WalrusClient()
    retriever = FullCatalogRetriever(llm, _PROMPTS_DIR)
    engine = ChatEngine(
        chain=chain, walrus=walrus, llm=llm, retriever=retriever, prompts_dir=_PROMPTS_DIR
    )

    console.rule("[bold cyan]Cortex Chat[/bold cyan]")
    rprint("[dim]Ask a question. Ctrl-D or 'exit' to quit.[/dim]\n")

    history: list[ChatMessage] = []
    while True:
        try:
            question = console.input("[bold green]you> [/bold green]").strip()
        except (EOFError, KeyboardInterrupt):
            rprint("\n[dim]bye[/dim]")
            break
        if not question:
            continue
        if question.lower() in {"exit", "quit"}:
            break

        history.append(ChatMessage(role="user", content=question))
        try:
            resp = engine.respond(history)
        except ChatError as exc:
            rprint(f"[red]Error:[/red] {exc}")
            history.pop()  # don't keep a turn we couldn't answer
            continue

        console.rule("[bold green]Cortex[/bold green]")
        console.print(resp.answer, markup=False)
        history.append(ChatMessage(role="assistant", content=resp.answer))

        if resp.citations:
            console.rule("[bold]Sources[/bold]")
            for c in resp.citations:
                rprint(f"  [cyan]{c.slug}[/cyan] -> [dim]{c.source_title}[/dim]")
                rprint(f"    blob: [yellow]{c.source_blob_id}[/yellow]")
        rprint("")
```

- [ ] **Step 3: Verify the command registers**

Run: `cd agent && python -m cortex_cli --help`
Expected: output lists a `chat` command.

- [ ] **Step 4: Smoke-test against the live wiki (requires `.env` + testnet)**

Run: `cd agent && python -m cortex_cli chat`
Then type: `What should I do if I lose my passport abroad?`
Expected: a grounded answer with `[[slug]]` tags and a Sources block listing real blob IDs. Type `exit` to quit.

- [ ] **Step 5: Commit**

```bash
git add agent/cortex_cli/__main__.py
git commit -m "feat(chat): add cortex chat multi-turn CLI command"
```

---

## Phase 3 — API (`POST /api/chat`)

### Task 8: Flask chat endpoint

**Files:**
- Modify: `agent/api_server.py` (add import + endpoint after `/api/health`, ~line 143)
- Test: `agent/tests/test_api_chat.py`

- [ ] **Step 1: Write the failing test (Flask test client + monkeypatched engine)**

```python
# agent/tests/test_api_chat.py
import pytest

import api_server
from chat.types import ChatResponse, Citation


@pytest.fixture
def client():
    api_server.app.config["TESTING"] = True
    return api_server.app.test_client()


def test_chat_requires_messages(client):
    resp = client.post("/api/chat", json={})
    assert resp.status_code == 400


def test_chat_returns_answer(client, monkeypatch):
    fake = ChatResponse(
        answer="Go to embassy [[lost-passport]].",
        citations=(Citation("lost-passport", "PB1", "RAW1", "Permenlu"),),
        pages_used=("lost-passport",),
        refused=False,
    )
    monkeypatch.setattr(api_server, "_run_chat", lambda messages: fake)

    resp = client.post("/api/chat", json={"messages": [{"role": "user", "content": "lost passport"}]})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["refused"] is False
    assert data["pages_used"] == ["lost-passport"]
    assert data["citations"][0]["source_blob_id"] == "RAW1"
    assert data["error"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && python -m pytest tests/test_api_chat.py -v`
Expected: FAIL (`/api/chat` returns 404, or `_run_chat` attribute missing)

- [ ] **Step 3: Add import + endpoint to `agent/api_server.py`**

Add to the imports near the top (after `from flask_cors import CORS`, ~line 23). Because `api_server.py` adds `_AGENT_DIR` to `sys.path` at call time, import `ChatMessage`/`ChatError` lazily inside the helpers to match the file's existing lazy-import style. Add this module-level import after `_AGENT_DIR` is defined (~line 28):

```python
sys.path.insert(0, str(_AGENT_DIR))
from chat.types import ChatError, ChatMessage  # noqa: E402
```

Add the helper and route after the `/api/health` route (~line 143):

```python
def _run_chat(messages: list[ChatMessage]):
    """Build a stateless engine per request and return a ChatResponse."""
    sys.path.insert(0, str(_AGENT_DIR))
    from chain import ChainClient
    from walrus.client import WalrusClient
    from llm import LLMClient, LLMConfig
    from chat.engine import ChatEngine
    from chat.retriever import FullCatalogRetriever

    prompts_dir = _AGENT_DIR / "llm" / "prompts"
    llm = LLMClient(LLMConfig.from_env())
    retriever = FullCatalogRetriever(llm, prompts_dir)
    engine = ChatEngine(
        chain=ChainClient(), walrus=WalrusClient(), llm=llm,
        retriever=retriever, prompts_dir=prompts_dir,
    )
    return engine.respond(messages)


@app.route("/api/chat", methods=["POST"])
def chat():
    body = request.get_json(silent=True) or {}
    raw_messages = body.get("messages")
    if not isinstance(raw_messages, list) or not raw_messages:
        return jsonify({"error": "messages (non-empty list) is required"}), 400

    try:
        messages = [
            ChatMessage(role=str(m["role"]), content=str(m["content"]))
            for m in raw_messages
        ]
    except (KeyError, TypeError):
        return jsonify({"error": "each message needs 'role' and 'content'"}), 400

    try:
        resp = _run_chat(messages)
    except ChatError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:  # config/provider errors
        return jsonify({"error": f"Chat failed: {exc}"}), 502

    return jsonify({
        "answer": resp.answer,
        "citations": [
            {
                "slug": c.slug,
                "page_blob_id": c.page_blob_id,
                "source_blob_id": c.source_blob_id,
                "source_title": c.source_title,
            }
            for c in resp.citations
        ],
        "pages_used": list(resp.pages_used),
        "refused": resp.refused,
        "error": None,
    })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && python -m pytest tests/test_api_chat.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add agent/api_server.py agent/tests/test_api_chat.py
git commit -m "feat(chat): add POST /api/chat stateless endpoint"
```

---

## Phase 4 — Web ("Ask Cortex")

> The site is React+Vite+TS in `site/src/app/`. There is no JS test runner wired,
> so these tasks use build + manual verification. For the API base URL, reuse the
> same constant the ingest flow uses (Task 9 Step 1) rather than hardcoding one.

### Task 9: Chat API client (`site/src/app/lib/chatApi.ts`)

**Files:**
- Create: `site/src/app/lib/chatApi.ts`

- [ ] **Step 1: Find the API base URL the ingest flow uses**

Run: `cd site && grep -rn "api/ingest\|API_BASE\|localhost:5" src/app | head`
Note the exact constant name and where it is defined (e.g. an `API_BASE` export, or an inline host like `http://localhost:5057`). Use that in Step 2.

- [ ] **Step 2: Create the client (point the import at the constant found in Step 1)**

```typescript
// site/src/app/lib/chatApi.ts
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatCitation {
  slug: string
  page_blob_id: string
  source_blob_id: string
  source_title: string
}

export interface ChatResponse {
  answer: string
  citations: ChatCitation[]
  pages_used: string[]
  refused: boolean
  error: string | null
}

// Reuse the same base the ingest calls use (see Step 1). If ingest uses an
// inline host, define the same inline host here; if it exports a constant,
// import that constant instead of redeclaring it.
import { API_BASE } from './apiBase' // adjust path/name to match Step 1

export async function sendChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const data = (await res.json()) as ChatResponse
  if (!res.ok) {
    throw new Error(data.error || `Chat request failed (${res.status})`)
  }
  return data
}
```

- [ ] **Step 3: Type-check / build**

Run: `cd site && pnpm build`
Expected: build succeeds (fix the `API_BASE` import to match Step 1 if it errors).

- [ ] **Step 4: Commit**

```bash
git add site/src/app/lib/chatApi.ts
git commit -m "feat(chat): add web chat API client"
```

---

### Task 10: Citations component (`ChatCitations.tsx`)

**Files:**
- Create: `site/src/app/components/ChatCitations.tsx`

- [ ] **Step 1: Confirm the page-detail route format**

Run: `cd site && grep -rn "page/\|createHashRouter\|createBrowserRouter\|<Route" src/app | head`
Note whether routes are hash-based (`#/page/:slug`) or browser (`/page/:slug`). Use the matching `href` in Step 2.

- [ ] **Step 2: Create the component (adjust `href` to the route format from Step 1)**

```tsx
// site/src/app/components/ChatCitations.tsx
import type { ChatCitation } from '../lib/chatApi'

interface ChatCitationsProps {
  citations: ChatCitation[]
}

export function ChatCitations({ citations }: ChatCitationsProps) {
  if (citations.length === 0) return null
  return (
    <ul className="chat-citations" aria-label="Sources">
      {citations.map((c) => (
        <li key={`${c.slug}-${c.source_blob_id}`}>
          <a href={`#/page/${c.slug}`}>{c.slug}</a>
          <span className="chat-citations__title"> — {c.source_title}</span>
          <code className="chat-citations__blob">{c.source_blob_id}</code>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Build + commit**

Run: `cd site && pnpm build`
Expected: build succeeds.

```bash
git add site/src/app/components/ChatCitations.tsx
git commit -m "feat(chat): add clickable chat citations component"
```

---

### Task 11: Chat bubble component (`ChatBubble.tsx`)

**Files:**
- Create: `site/src/app/components/ChatBubble.tsx`

- [ ] **Step 1: Create the component**

```tsx
// site/src/app/components/ChatBubble.tsx
import type { ChatCitation } from '../lib/chatApi'
import { ChatCitations } from './ChatCitations'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  text: string
  citations?: ChatCitation[]
}

export function ChatBubble({ role, text, citations }: ChatBubbleProps) {
  return (
    <div className={`chat-bubble chat-bubble--${role}`}>
      <p className="chat-bubble__text">{text}</p>
      {role === 'assistant' && citations ? <ChatCitations citations={citations} /> : null}
    </div>
  )
}
```

Note: render `text` as plain text (React escapes it) — do NOT use
`dangerouslySetInnerHTML`. The `[[slug]]` tags stay visible as text; the clickable
provenance lives in the citations list (anti-XSS, per repo web security rules).

- [ ] **Step 2: Build + commit**

Run: `cd site && pnpm build`
Expected: build succeeds.

```bash
git add site/src/app/components/ChatBubble.tsx
git commit -m "feat(chat): add chat bubble component"
```

---

### Task 12: Ask Cortex page + route + nav link

**Files:**
- Create: `site/src/app/pages/AskCortex.tsx`
- Modify: the router file and the NavBar file (located in Step 1)

- [ ] **Step 1: Locate router and NavBar, and study the SourcesScreen wiring**

Run: `cd site && grep -rln "NavBar\|createHashRouter\|createBrowserRouter\|SourcesScreen" src/app | head`
Open the router file and the NavBar component. Note exactly how `SourcesScreen` is
registered as a route and linked in the nav — mirror that for `AskCortex`.

- [ ] **Step 2: Create the page**

```tsx
// site/src/app/pages/AskCortex.tsx
import { useState } from 'react'
import { sendChat, type ChatMessage, type ChatCitation } from '../lib/chatApi'
import { ChatBubble } from '../components/ChatBubble'

interface Turn {
  role: 'user' | 'assistant'
  text: string
  citations?: ChatCitation[]
}

export function AskCortex() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || busy) return

    const nextTurns: Turn[] = [...turns, { role: 'user', text: question }]
    setTurns(nextTurns)
    setInput('')
    setBusy(true)
    setError(null)

    const history: ChatMessage[] = nextTurns.map((t) => ({ role: t.role, content: t.text }))
    try {
      const resp = await sendChat(history)
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', text: resp.answer, citations: resp.citations },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="ask-cortex" aria-labelledby="ask-heading">
      <h1 id="ask-heading">Ask Cortex</h1>
      <p>Every answer is grounded in the wiki — click a source to trace it.</p>

      <div className="ask-cortex__thread">
        {turns.map((t, i) => (
          <ChatBubble key={i} role={t.role} text={t.text} citations={t.citations} />
        ))}
        {busy ? <p className="ask-cortex__status">Thinking…</p> : null}
        {error ? <p className="ask-cortex__error" role="alert">{error}</p> : null}
      </div>

      <form className="ask-cortex__form" onSubmit={onSubmit}>
        <input
          aria-label="Your question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What do I do if I lose my passport abroad?"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>Ask</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Register the route and nav link**

Mirror the `SourcesScreen` registration from Step 1: add an `AskCortex` route
(e.g. path `ask` → `#/ask`) and a NavBar link labeled "Ask Cortex".

- [ ] **Step 4: Build + manual verification**

Run: `cd site && pnpm build`
Expected: build succeeds.

Then, with the API server running (`cd agent && python api_server.py`) and the dev
site (`cd site && pnpm dev`): open the site, click "Ask Cortex", ask a passport
question. Expected: an answer bubble with a Sources list whose links open the cited
page; an unrelated question yields the refusal message.

- [ ] **Step 5: Commit**

```bash
git add site/src/app/pages/AskCortex.tsx <router-file> <navbar-file>
git commit -m "feat(chat): add Ask Cortex web page, route, and nav link"
```

---

## Phase 5 — Wrap-up

### Task 13: Full test run + docs

- [ ] **Step 1: Run the complete Python suite**

Run: `cd agent && python -m pytest -v`
Expected: all tests pass (existing + new chat tests).

- [ ] **Step 2: Update CLAUDE.md project state**

Add a bullet under "State proyek saat ini" in `CLAUDE.md`:
`- [x] Chat (RAG) — cortex chat (CLI) + POST /api/chat + Ask Cortex web page; verified per-claim provenance`

- [ ] **Step 3: Add a chat beat to the demo script**

In `docs/DEMO_SCRIPT.md`, add a step: ask Cortex a passport question, show the
answer, click a citation through to the raw source blob, and note that an
out-of-scope question is refused (no hallucination).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/DEMO_SCRIPT.md
git commit -m "docs(chat): record chat feature in project state and demo script"
```

---

## Notes for the implementer

- **Run everything from `agent/`** so the `chat`, `chain`, `walrus`, `llm`, and
  `cortex_cli` packages resolve (matches existing test + CLI conventions).
- **Never let the LLM emit blob IDs.** `build_citations` is the only place blob IDs
  enter an answer's provenance, derived from page content.
- **Refusal is correct behavior**, not a failure — an empty selection or empty
  catalog returns `refused=True` with no fabricated answer.
- **Embeddings are out of scope.** Keep `engine.py` free of retrieval internals so a
  future `EmbeddingRetriever` (or Walrus-blob vector index) implements the same
  `Retriever.find_relevant` signature and drops in unchanged.
```
