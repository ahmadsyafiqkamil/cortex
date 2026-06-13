# DOCKER.md — Cortex Dev Container

Reproducible environment for Cortex. All tooling (`sui`, `walrus`, `site-builder`,
Node 22, Python 3.12) lives in the image. **Secrets and wallet state live in volumes
and `.env`, never in the image.**

> ⚠️ The Sui/Walrus ecosystem moves fast. If a command fails, check the official docs
> (docs.sui.io, docs.wal.app) before guessing — same rule as [SETUP.md](SETUP.md).

---

## 1. Prerequisites (host)

Docker Engine + Compose plugin. Verify:

```bash
docker --version
docker compose version
```

If missing on Ubuntu: install via the official Docker apt repository
(docs.docker.com/engine/install/ubuntu).

## 2. Configure secrets

```bash
cp .env.example .env
```

Edit `.env` and fill in the **provider-agnostic LLM** values (you supply these):

```
LLM_BASE_URL=...      # OpenAI-compatible endpoint
LLM_API_KEY=...
LLM_MODEL=...
LLM_GROUP_ID=         # only if your provider needs it
```

`.env` is gitignored — never commit it.

## 3. Build & start

```bash
docker compose build
docker compose up -d
docker compose exec cortex-dev bash      # shell into the container
```

> **GitHub rate limit on build:** `suiup` fetches release lists from the GitHub API.
> The anonymous limit is 60 req/hr per IP, so a clean rebuild can fail with `403`.
> To avoid it, pass a token (5000 req/hr):
> ```bash
> export GITHUB_TOKEN=ghp_xxx        # any GitHub PAT, no scopes needed
> docker compose build               # compose forwards it as a build arg
> ```
> The binaries are then cached in the image. Selecting the default version (so
> `sui`/`walrus`/`site-builder` resolve on PATH) is a **local** operation done by
> `scripts/dev-entrypoint.sh` at container start — it needs no network and is
> unaffected by rate limits.

Verify tooling inside the container:

```bash
sui --version && walrus --version && site-builder --version && node -v && python3 --version
```

## 4. One-time interactive bootstrap (inside the container)

These steps can't be automated (wallet creation, faucet, token swap). Run them once;
the keystore persists in the `sui-config` named volume.

### 4.1 Sui testnet + two addresses (Agent A & B)

```bash
sui client                       # wizard: choose testnet fullnode, create ed25519 key
sui client active-env            # must print: testnet
sui client new-address ed25519   # this is AGENT B
sui client addresses             # record BOTH addresses
```

> CLAUDE.md aturan keras #3: Agent A (ingest) and Agent B (lint/dispute) MUST be
> separate keypairs. Keep them separate.

### 4.2 Faucet for both addresses

```bash
sui client switch --address <ADDR_A> && sui client faucet
sui client switch --address <ADDR_B> && sui client faucet
sui client gas                   # verify balance on each
```

If the CLI faucet is rate-limited, use the official Sui Discord/web faucet.

### 4.3 Walrus testnet config + WAL tokens

```bash
walrus info --context testnet    # must show "Epoch duration: 1day" (= testnet)
walrus get-wal                   # swap testnet SUI -> WAL (check `walrus --help` if subcommand differs)
```

If the walrus client config is missing, fetch the current testnet config per
docs.wal.app/docs/getting-started into `~/.config/walrus/`.

### 4.4 Smoke test store/read (TASKS.md 1.2) — ALWAYS `--epochs max`

```bash
echo "cortex smoke test $(date)" > /tmp/smoke.txt
walrus store /tmp/smoke.txt --epochs max --context testnet   # note the blob ID
walrus read <BLOB_ID> --context testnet > /tmp/smoke_out.txt
diff /tmp/smoke.txt /tmp/smoke_out.txt && echo OK
```

> ⚠️ Testnet epoch = 1 day. **Every `walrus store` in this project uses `--epochs max`.**

### 4.5 Python agent env + LLM smoke test

```bash
cd /workspace/agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m cortex_cli llm-smoke    # once the CLI exists; reads LLM_* from env
```

## 5. Persistence & migration (VPS ↔ local)

| What | Where it lives | Survives rebuild? |
|---|---|---|
| Sui keystore (Agent A & B keys) | `sui-config` named volume | ✅ |
| Walrus config | `walrus-config` named volume | ✅ |
| `agent/.cortex/` (package/wiki IDs) | host bind mount (gitignored) | ✅ |
| LLM creds | `.env` (host) | ✅ |
| Blobs / on-chain objects | Walrus + Sui testnet (decentralized) | ✅ (not machine-bound) |

To move to a local machine: copy the named volumes (`docker run --rm -v sui-config:/v ...`
tar trick) or restore the keystore, copy `.env` and `agent/.cortex/`, then build the same
image. On-chain objects and blobs are reachable from anywhere.

## 6. Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `suiup install` fails at build | Install script URL/binary changed | Check github.com/MystenLabs/suiup; update Dockerfile |
| `walrus store` balance error | No WAL testnet | `walrus get-wal` (§4.3) |
| `Epoch duration` not 1day | Config points to mainnet | Check `--context testnet` + config file |
| Keystore gone after rebuild | Volume not mounted | Ensure `sui-config` volume in docker-compose.yml |
| LLM call 401/404 | Wrong base URL/key/model | Re-check `.env` against provider docs |
