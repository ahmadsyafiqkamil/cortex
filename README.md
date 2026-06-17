# Cortex

**Decentralized knowledge base maintained by AI agents** — built for Sui Overflow 2026 (Walrus Track).

Cortex applies the [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
pattern (raw sources → interlinked wiki → schema) on top of **Walrus** (immutable,
content-addressed storage) with **Sui Move** as the coordination layer. Every wiki page
is an immutable Walrus blob; a Sui object points to the latest version and records
relationships between pages.

> **Positioning:** Cortex guarantees **verifiable provenance** — *who wrote what, when,
> from which source, and whether anyone disputes it* — not "verifiable truth". This is the
> Wikipedia model ("verifiability, not truth") moved onto trustless infrastructure.

## Why not Git?

Git gives you history and hashing, but requires a hosted remote owned by one party and
can't be read by a smart contract. Cortex enables: (a) agents from different
organizations co-curating one wiki without a shared server, (b) on-chain contracts
verifying knowledge state, (c) wikis that outlive their maintainer.

## How it works

```
Raw Source (PDF/doc)
  → [1] Store on Walrus        → raw_blob_id (immutable)
  → [2] Register on Sui        → event SourceRegistered
  → [3] LLM extracts concepts  → draft pages (markdown)
  → [4] Store pages on Walrus  → page_blob_id (new version)
  → [5] Update pointer on Sui  → latest_blob + history
  → [6] Record [[wikilinks]]   → event LinkAdded
  → [7] Update _index & _log   → system pages
```

**Walrus holds the content. Sui holds pointers, identity, and coordination.** No database,
no shared server.

## Features

| Feature | Status |
|---|---|---|
| **Multi-agent wiki** — Agent A (ingest) + Agent B (lint/dispute) on same wiki | Done |
| **Verifiable provenance** — every claim traces back to raw source blob | Done |
| **Dispute layer** — open disagreements as first-class on-chain records | Done |
| **Lint agent** — broken wikilinks, orphan pages, anti-feedback-loop checks | Done |
| **Chat (RAG)** — multi-turn chat with per-claim provenance citations | Done |
| **Walrus Site** — public wiki + graph view + confidence badges + time-travel diff | Done |
| **Time travel** — view any blob version, diff any two versions | Done |
| **Confidence score** — unique source count per claim | Done |
| **Provenance attestation** — wallet sign-in + on-chain attest (F11) | Done |
| **Contributor lifecycle** — apply / approve / reject / revoke on-chain | Done |

## Quick start

```bash
# Prerequisites: sui >= 1.73, walrus, site-builder, Python 3.11+, Node 22+, pnpm

# Agent CLI
cp agent/.env.example agent/.env    # LLM_BASE_URL + LLM_API_KEY + LLM_MODEL
cd agent && python -m pip install -r requirements.txt

# Commands
python -m cortex_cli ingest <url|file>              # Ingest a raw source (Agent A)
python -m cortex_cli query "your question"          # Ask with provenance citations
python -m cortex_cli chat                            # Multi-turn RAG chat (in-memory session)
python -m cortex_cli trace <slug> "<claim>"         # Trace claim → raw source
python -m cortex_cli lint                           # Quality checks (read-only)
python -m cortex_cli dispute raise ...              # File dispute (Agent B)
python -m cortex_cli dispute resolve ...            # Resolve/reject dispute
python -m cortex_cli dispute list                   # List disputes
python -m cortex_cli attest <slug>                  # Attest provenance on-chain
python -m cortex_cli edit <slug>                    # Edit a wiki page
python -m cortex_cli contributor apply/approve/...  # Contributor lifecycle

# API server (for Chat frontend)
cd agent && python api_server.py                    # Runs on http://localhost:5001

# Site (build only; deploy needs WAL tokens)
cd site && pnpm install && pnpm run build           # Build to dist/
# site-builder --context=testnet deploy --epochs max site/dist

# End-to-end test
bash scripts/demo_e2e.sh
```

## Project structure

```
cortex/
├── move/cortex/            # Sui Move package (wiki.move, source.move, dispute.move, attest.move, contributor.move)
├── agent/                  # Python agents + CLI
│   ├── cortex_cli/         # ingest, query, chat, trace, lint, dispute, attest, edit, contributor
│   ├── chain/              # sui client wrapper
│   ├── walrus/             # walrus CLI wrapper
│   ├── chat/               # Chat engine (RAG retriever, catalog, citations)
│   ├── llm/                # LLM prompts & parsing (provider-agnostic)
│   └── api_server.py       # Flask API server for Chat frontend (port 5001)
├── site/                   # Walrus Site (Vite + React + TypeScript + TailwindCSS v4)
│   ├── src/app/            # pages, components, lib
│   └── dist/               # Build output (deploy folder)
├── scripts/                # demo_e2e.sh, deploy scripts
└── docs/                   # PRD, architecture, tasks, demo script, setup, docker, sui-cli
```

## Deployment

| | |
|---|---|
| Network | Sui Testnet |
| Package ID | `0x823f71d5795240a23e6ae2e7ca195faf93b3a55782f7b3a143f40babc8bf3b7e` |
| Wiki object ID | `0xd55c7cc26ccad850e2b549a5ec88db8983ea732823fc0c60849b1f7891f86755` |
| Agent A | `0x6034727b72070c008e8d947d0289915e92fa77630b39d4d7d6fc61fadf0e3e89` |
| Agent B | `0x50126de47be4156ab355685b76eb2fabe94908ea4350fd192727c3c710eeb86a` |
| Site URL | `http://qysquom1w51gupfuxenkfw3201fg32dntpmmimxgwxdknw66w.localhost:3000` (portal required) |
| Site Object ID | `0x1e0deb8bd5b9ffa4db7dbf93b0f8fe627813c4ce104d235c51f3ccb624c33e58` |
| Explorer | [View on Suiscan](https://suiscan.xyz/testnet/object/0xd55c7cc26ccad850e2b549a5ec88db8983ea732823fc0c60849b1f7891f86755) |

## Documentation

| Doc | What it covers |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Scope, P0/P1/P2 features, success criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical design (Move schema, page format, component contracts) |
| [docs/TASKS.md](docs/TASKS.md) | Day-by-day task breakdown + acceptance criteria |
| [docs/SETUP.md](docs/SETUP.md) | Environment setup from scratch |
| [docs/DOCKER.md](docs/DOCKER.md) | Docker dev container setup |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | 5-minute demo script + acceptance test |
| [docs/SUI_CLI.md](docs/SUI_CLI.md) | Quick reference for sui client commands |
