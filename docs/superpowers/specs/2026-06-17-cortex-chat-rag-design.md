# Cortex Chat (RAG) — Design Spec

| | |
|---|---|
| **Date** | 2026-06-17 |
| **Owner** | Ahmad Syafiq Kamil |
| **Feature** | `cortex chat` (CLI) + "Ask Cortex" (web) — conversational search over the wiki |
| **Status** | Approved design, ready for implementation plan |
| **Target** | Sui Overflow 2026 — Track Walrus. Submission 2026-06-21. |

---

## 1. Summary

A multi-turn chatbot that answers questions using only the knowledge compiled in
the Cortex wiki, via **RAG (Retrieval-Augmented Generation)**. The existing
provider-agnostic LLM (MiniMax, through the OpenAI-compatible `LLMClient`) is fed
relevant wiki pages and produces a natural-language answer. Every answer carries
**verifiable provenance**: each claim is traceable through page → raw source blob,
with blob IDs injected by code (never produced by the LLM).

The feature reuses the RAG pipeline already implemented in the `cortex query`
command and lifts it into a reusable engine shared by two frontends: the CLI and
the web site (via a Flask endpoint).

### Positioning guardrail (non-negotiable)
Cortex guarantees **verifiable provenance, not verifiable truth**. The chatbot
must never present an uncited claim as authoritative; hallucination is mitigated
in layers and, where it survives, made **auditable and disputable** rather than
hidden. Never use the phrase "verifiable knowledge".

---

## 2. Decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|---|---|
| D1 | Build **both** CLI and web on **one shared engine** | KISS/DRY; one brain, two frontends. Not double work. |
| D2 | **Multi-turn** with conversation memory | Feels like a real chatbot; supports follow-ups ("explain that further"). |
| D3 | **Stateless backend** — frontend holds history, sends it whole each request | No session DB; simplest; demo-appropriate. |
| D4 | Reuse **existing `LLMClient`** (MiniMax via OpenAI-compatible env) | No new LLM code; provider-agnostic already in place. |
| D5 | **Balanced retrieval (C)**: no separate query-rewriting call; history is injected into the answer prompt so the model resolves "that/it" while answering | ~2 MiniMax calls per turn; good quality/effort ratio. |
| D6 | **Full-catalog selection** for retrieval at current scale (~26 pages) | High recall by *meaning*, not keyword; whole title+summary list fits one prompt. |
| D7 | **Anti-hallucination level B**: sentence-level citations verified by code | The differentiator vs a generic chatbot; ~half-day extra. |
| D8 | **Embeddings deferred to post-hackathon (P2)** behind a `Retriever` seam | Avoids scope creep against the 4-day deadline; design keeps the swap-in point. |
| D9 | **Walrus-blob vector index deferred to roadmap** (pitch headline) | Strong Walrus-track narrative, but immutability → index-lifecycle cost is multi-day. Not now. |

---

## 3. Architecture

One stateless RAG engine, two frontends.

```
                    ┌──────────────────────────────┐
   CLI ───────────► │  chat engine (agent/chat/)   │
   (cortex chat)    │                              │
                    │  1. retrieve (full catalog)  │ ◄── catalog from Walrus pages
   Web chatbox ───► │  2. MiniMax #1: select pages │ ◄── LLMClient (existing)
   (POST /api/chat) │  3. fetch page content       │ ◄── WalrusClient (existing)
                    │  4. MiniMax #2: answer        │ ◄── ChainClient (existing)
                    │     (+ conversation history)  │
                    │  5. verify + inject blob IDs │ ◄── HARD RULE: code, not LLM
                    └──────────────────────────────┘
                              │
                              ▼
                ChatResponse { answer, citations[], pages_used[], refused }
```

### Turn flow
1. **Retrieve** — build a catalog `{slug, title, one-line summary}` from current
   wiki pages (read via Chain + Walrus, cache-first). At current scale the full
   catalog is passed to selection.
2. **MiniMax call #1 (select)** — given the question + recent history + the full
   catalog, return JSON `{relevant_slugs: [...]}`. Empty list ⇒ refusal path.
3. **Fetch** — code reads the selected pages' content from Walrus.
4. **MiniMax call #2 (answer)** — given page content + conversation history + the
   question, produce a natural answer with per-claim `[[slug]]` tags. The model
   resolves "that/it" here (no separate rewrite call).
5. **Verify + cite** — `citations.py` validates each `[[slug]]` tag against the
   pages actually fed; invalid tags' claims are flagged/dropped. Code attaches
   real blob IDs (page blob + raw source blob). The LLM never emits blob IDs.

### Enforced hard rules
- **LLM never produces Walrus blob IDs.** Code injects them (ARCHITECTURE.md §4.4).
- **Strict grounding.** If selection returns no relevant page, the engine refuses
  ("Not yet in the Cortex knowledge base") instead of fabricating an answer.

---

## 4. Anti-hallucination (layered)

| Layer | Mechanism | Cost |
|---|---|---|
| L1 | Strict grounding prompt: answer only from provided pages; say "don't know" otherwise. Temperature 0.2. | ~free |
| L2 | Refusal path: no relevant page ⇒ no answer call at all. | ~free |
| L3 | **Sentence-level citations verified by code**: model tags each claim with `[[slug]]`; code validates the slug was actually fed; invalid claims flagged/dropped; real blob IDs attached programmatically. | ~half-day |
| L4 | Hallucination becomes **visible**: every claim click-throughs to the raw source blob; humans/agents can audit and raise the existing dispute flow. | reuses existing |

Honest limit: RAG reduces but does not eliminate hallucination. Cortex's edge is
that surviving hallucination is **detectable and disputable**, consistent with the
project thesis.

---

## 5. Components & files

### Backend — new package `agent/chat/` (focused files, <300 lines each)
```
agent/chat/
├── __init__.py
├── types.py        # frozen dataclasses: ChatMessage, PageRef, Citation, ChatResponse
├── retriever.py    # Retriever (Protocol) + FullCatalogRetriever  ← embeddings seam
├── catalog.py      # build {slug, title, one-line summary} catalog from Walrus pages
├── engine.py       # orchestrate one turn: retrieve → select → fetch → answer → cite
└── citations.py    # parse per-claim [[slug]] tags + code verification + blob-ID inject
```

Responsibilities:
- `retriever.py` — `FullCatalogRetriever.find_relevant(question, history) -> list[slug]`
  (MiniMax call #1). Behind the `Retriever` Protocol so `WalrusVectorRetriever`
  (roadmap) drops in without touching `engine.py`.
- `engine.py` — stateless brain. Takes `(messages, question)`, returns
  `ChatResponse`. Reuses `ChainClient`, `WalrusClient`, `LLMClient`, `pageformat`.
- `citations.py` — Layer 3. Validates `[[slug]]` tags; drops/flags invalid claims;
  attaches real blob IDs via `extract_markers` + `resolve_source_title`.

### Prompts — `agent/llm/prompts/`
- `chat_select.md` — call #1: full catalog + question + history → JSON
  `{relevant_slugs: [...]}` or `[]` (refusal / L2).
- `chat_answer.md` — call #2: page content + history + question → answer with
  per-claim `[[slug]]` tags, strict grounding (L1).

### CLI — `cortex chat` in `cortex_cli/__main__.py`
Multi-turn REPL: read input → call engine → render answer + sources (same display
pattern as `query`, lines 388–410) → keep history in-memory for the session.
`Ctrl-D` exits.

### API — `POST /api/chat` in `agent/api_server.py`
Stateless. Accepts `{messages: [...]}`, returns `ChatResponse` JSON. Frontend holds
history and sends it whole each request. Read-only (no on-chain mutation, no cap).

### Web — "Ask Cortex" in `site/src/app/`
```
pages/AskCortex.tsx          # chat page (new route + NavBar link)
components/ChatBubble.tsx     # user/assistant message bubble
components/ChatCitations.tsx  # clickable citations → PageDetail / Suiscan
lib/chatApi.ts               # fetch wrapper for /api/chat
```

---

## 6. Data contracts

### Core types (`agent/chat/types.py`) — all `frozen`
```python
@dataclass(frozen=True)
class ChatMessage:
    role: str          # "user" | "assistant"
    content: str

@dataclass(frozen=True)
class Citation:
    slug: str
    page_blob_id: str     # PageRecord.latest_blob
    source_blob_id: str   # raw source blob (the real provenance)
    source_title: str

@dataclass(frozen=True)
class ChatResponse:
    answer: str                       # answer with verified per-claim [[slug]] tags
    citations: tuple[Citation, ...]
    pages_used: tuple[str, ...]
    refused: bool                     # True ⇒ no relevant page; nothing fabricated
```

### API request `POST /api/chat`
```json
{ "messages": [ {"role":"user","content":"..."}, {"role":"assistant","content":"..."} ] }
```

### API response (envelope consistent with repo pattern)
```json
{
  "answer": "Prosedur ... [[penggantian-dokumen-perjalanan]]",
  "citations": [
    {
      "slug": "penggantian-dokumen-perjalanan",
      "page_blob_id": "0x..",
      "source_blob_id": "0x..",
      "source_title": "Permenlu No.."
    }
  ],
  "pages_used": ["penggantian-dokumen-perjalanan"],
  "refused": false,
  "error": null
}
```

---

## 7. Error handling (explicit at every boundary)

| Condition | Behavior |
|---|---|
| `LLM_*` env missing | CLI: clear message + exit 1. API: `502` + `error` set. |
| MiniMax timeout/failure | Reuse `_llm_complete_with_retry`. After retries → `error`, `refused:true`; frontend shows "try again". |
| Walrus read fails (a page) | Skip that page, continue with the rest. If **all** fail → `refused:true`. |
| Chain `list_pages` fails | `502` + `error`. CLI: exit 1. |
| Selection returns `[]` | Refusal path — no answer call. `refused:true`, answer = "Not yet in the Cortex knowledge base." |
| Model tags a slug not fed | Layer 3: that claim flagged/dropped by `citations.py`. |
| `messages` empty/malformed | `400` + `error` (validated at API boundary). |
| Very long history | Trim to last N turns (e.g. 6) before prompting to bound context size. |

### Security notes
- LLM never emits blob IDs — code injects them (HARD RULE preserved).
- No raw LLM HTML rendered in the web UI — text is escaped; only `[[slug]]` tags
  are converted to controlled links (anti-XSS).
- `/api/chat` is read-only — no on-chain mutation, no capability used.

---

## 8. Testing (pytest, no network — mock LLM/Walrus/Chain)

```
agent/tests/test_chat_retriever.py   # selection: relevant chosen; empty → refusal
agent/tests/test_chat_citations.py   # Layer 3: fake slug dropped; real blob IDs attached
agent/tests/test_chat_engine.py      # end-to-end orchestration with mocked deps
```

Coverage target: 80%+ on the new `agent/chat/` package (repo testing rule).

---

## 9. Out of scope (deferred)

- **Embeddings / vector search** (P2) — design keeps the `Retriever` seam;
  `EmbeddingRetriever` swaps in later.
- **Walrus-blob vector index** (roadmap / pitch headline) — strong narrative, but
  immutable-blob index lifecycle is multi-day; not built this week.
- **Persistent conversation storage** — backend stays stateless; frontend owns
  history.
- **Per-query rewriting call** — folded into the answer prompt (D5).

---

## 10. Roadmap narrative (for the pitch)

"Next: a **decentralized semantic index on Walrus** — the AI's retrieval brain
itself stored as content-addressed, immutable blobs, so any agent can pull the
same vector index and run identical retrieval without a shared server." This
directly deepens the Walrus-track story and is enabled by the `Retriever` seam
shipped now.
