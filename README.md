# Cortex

**Decentralized knowledge base maintained by AI agents** — built for Sui Overflow 2026 (Walrus Track).

Cortex applies the [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
pattern (raw sources → interlinked wiki → schema) on top of **Walrus** (immutable,
content-addressed storage) with **Sui Move** as the coordination layer. Every wiki page
is an immutable Walrus blob; a Sui object points to the latest version and records the
relationships between pages.

> **Positioning:** Cortex guarantees **verifiable provenance** — *who wrote what, when,
> from which source, and whether anyone disputes it* — not "verifiable truth". This is the
> Wikipedia model ("verifiability, not truth") moved onto trustless infrastructure.

## Documentation

| Doc | What it covers |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Scope, P0/P1/P2 features, success criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical design (Move schema, page format, component contracts) |
| [docs/TASKS.md](docs/TASKS.md) | Day-by-day task breakdown + acceptance criteria |
| [docs/SETUP.md](docs/SETUP.md) | Native environment setup from scratch |
| [docs/DOCKER.md](docs/DOCKER.md) | Docker dev container setup (recommended) |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | 5-minute demo script + end-to-end acceptance test |

## Getting started

This repo ships a reproducible **Docker dev container** with all tooling
(`sui`, `walrus`, `site-builder`, Node, Python). See [docs/DOCKER.md](docs/DOCKER.md).

```bash
cp .env.example .env        # then fill in LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
docker compose build
docker compose up -d
docker compose exec cortex-dev bash
```

The LLM layer is **provider-agnostic** (OpenAI-compatible): point `LLM_BASE_URL` at any
provider (MiniMax, OpenAI, Gemini-compat, local) — no code change.

## Deployment status

| | |
|---|---|
| Package ID | (belum) |
| Wiki object ID | (belum) |
| Site URL | (belum) |

## License

TBD.
