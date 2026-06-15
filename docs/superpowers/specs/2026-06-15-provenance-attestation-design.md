# Provenance Attestation — Design Spec

**Date:** 2026-06-15
**Status:** Approved (brainstorming) — pending implementation plan
**Author:** Cortex team
**Deadline context:** Submission 21 Jun 2026, submit H-1 (20 Jun). ~5 days, solo.

## Summary

Add three connected capabilities to Cortex:

1. **Wallet sign-in** — connect a Sui wallet in the browser (the deployed Walrus Site).
2. **Provenance verification** — a verifier reviews a wiki page and attests, on-chain,
   that the page's claims trace to its registered raw sources.
3. **Verifier incentive** — each attestation is a non-economic on-chain object owned by
   the verifier (a "provenance badge"), plus a public per-page / per-verifier count
   derived from events.

The feature is deliberately scoped to respect three hard rules in `CLAUDE.md`:

- **Positioning:** Cortex guarantees *verifiable provenance*, never *verifiable
  truth/knowledge*. A verifier attests "claims trace to registered sources", **not**
  "this content is true". UI copy must reflect this.
- **Scope rule #6 (no reputasi/DAO):** the incentive is a non-transferable, non-economic
  attestation record — no coin, no token, no reputation score, no slashing.
- **Two-party identity:** wallet attestation is open to *any* address, which strengthens
  (does not replace) the existing Agent A / Agent B keypair separation.

## Non-goals (explicitly out of scope)

- Any fungible token / coin / SUI reward for verifiers.
- Reputation scoring, leaderboards with weights, slashing, staking.
- Verifier whitelist / `VerifierCap`.
- Replacing the Python CLI write path; this is additive.
- On-chain computation of provenance correctness (that stays off-chain in `lint`).

## Decisions (locked during brainstorming)

| # | Decision |
|---|----------|
| 1 | Verification = **provenance check** (human attests claims→sources). |
| 2 | Incentive = **on-chain attestation badge** (owned object + public count), non-economic. |
| 3 | Verifier = **any wallet** (new entry function, no `ContributorCap`). |
| 4 | Frontend = **enhance existing Eleventy site** with `@mysten/dapp-kit`, **lazy-loaded** JS. Dev locally / on VPS; demo deploy to Walrus Site. |
| 5 | Add **`cortex attest`** CLI command for testing and `demo_e2e.sh`. |
| 6 | Positive attestations only. Broken provenance → existing `dispute.move` flow. |

## Architecture

```
Browser (Walrus Site + lazy-loaded dapp-kit JS)
  ├─ Connect Sui wallet (extension)        ← "sign in" = wallet address identity
  ├─ On a page: show source citations + lint status
  ├─ "Attest provenance verified"
  │    └─ build Tx → cortex::attest::attest_provenance(wiki, page, page_blob)
  │    └─ wallet signs & submits to testnet
  └─ Show attestation count per page (queried from ProvenanceAttested events)

On-chain (new module cortex::attest)
  ├─ ProvenanceAttestation { wiki_id, page, page_blob, verifier } → owned by sender
  └─ event ProvenanceAttested { ... } → indexed by site / CLI

Off-chain (unchanged)
  └─ Raw sources + wiki page blobs on Walrus; provenance correctness checked by `lint`.
```

The verifier's "incentive" is twofold and entirely non-economic:
- the **ProvenanceAttestation objects they own** (visible in their wallet as proof of
  contribution), and
- a **public count** the site derives from `ProvenanceAttested` events (e.g. "12
  attestations on this page", "0xabc… has attested 5 pages").

Each attestation **pins to a specific page version** via `page_blob` (the page's current
Walrus blob id at attest time), so it means "I reviewed *this version*".

## Move: new module `cortex::attest`

One module per concern, consistent with `wiki` / `source` / `dispute`.

```move
module cortex::attest;

public struct ProvenanceAttestation has key, store {
    id: UID,
    wiki_id: ID,
    page: String,        // canonical slug
    page_blob: String,   // Walrus blob id of the version attested
    verifier: address,
}

public struct ProvenanceAttested has copy, drop {
    attestation_id: ID,
    wiki_id: ID,
    page: String,
    page_blob: String,
    verifier: address,
}

/// Open to ANY wallet — no ContributorCap. Page must exist on the wiki.
public fun attest_provenance(
    wiki: &Wiki,
    page: String,
    page_blob: String,
    ctx: &mut TxContext,
) { /* assert page_exists; create object; emit event; transfer to sender */ }
```

- No capability gate (open attestation).
- `assert!(wiki::page_exists(wiki, page), E_PAGE_NOT_FOUND)`.
- Object is `transfer::public_transfer`-ed to `ctx.sender()`.
- Read-only views: `attestation_page`, `attestation_verifier`, `attestation_blob`.
- **Tests:** (a) attest on existing page creates object + emits event; (b) attest on
  missing page aborts with `E_PAGE_NOT_FOUND`.

### Package migration (primary risk)

Adding a module requires republishing the package. To keep the existing `Wiki` shared
object (`0xd55c…`) usable, **use `sui client upgrade`** so the `cortex::wiki::Wiki` type
identity is preserved.

- Requires the `UpgradeCap` minted at original publish (owned by Agent A's address). It is
  **not currently recorded** in `agent/.cortex/config.json` — the plan must locate it
  (`sui client objects` on Agent A, filter `0x2::package::UpgradeCap`) and store its id.
- **Fallback if UpgradeCap is unavailable:** fresh `publish` → new Package ID → recreate
  the Wiki object and re-ingest demo pages. Acceptable on testnet but costs time; treat as
  contingency only.
- After upgrade: update Package ID (and any new ids) in `agent/.cortex/config.json` and in
  the site's `_data/config.js`. Update the State section of `CLAUDE.md`.

## Client: enhance the Eleventy site

- Add `@mysten/dapp-kit`, `@mysten/sui`, and a small React island, bundled (esbuild or
  Vite) into one asset that hydrates a **Verify panel** on `page.njk`.
- **Lazy-load:** the wallet bundle loads only when the reader clicks "Verify", so normal
  readers download no extra JS. (Knowingly exceeds the microsite JS budget once loaded;
  accepted for a hackathon dApp.)
- Reads Package ID / Wiki ID / network from the existing `_data/config.js`.
- Verify panel shows: the page's source citations, current `lint` status, "Connect Wallet"
  (= sign-in), and "Attest provenance verified" → builds & signs the tx; on success shows
  the tx digest + a Suiscan link.
- Per-page attestation count: query `ProvenanceAttested` events via fullnode RPC at
  page load (client-side), with a build-time snapshot as fallback.
- **UI copy guardrail:** label is "Provenance verified" / "Provenans terverifikasi", never
  "verified true" / "terbukti benar".

### Hosting

- Frontend works from any host (localhost / VPS / Walrus Site): wallet signing hits Sui
  fullnode RPC; Walrus reads hit aggregator HTTP. Hosting location does not limit function.
- Dev on localhost/VPS (free, fast). Final demo deploy to Walrus Site (Track Walrus
  narrative; testnet WAL/SUI from faucet). Deploy only from `site/dist/` (rule #5).

## CLI: `cortex attest`

```
cortex attest <page-slug> [--agent a|b]
```

- Resolves the page's current `page_blob` via `ChainClient.get_page_record`.
- Calls `cortex::attest::attest_provenance` via `call_move` using the selected agent
  keypair (defaults to a test identity).
- Prints the created attestation object id + tx digest.
- Add a step to `scripts/demo_e2e.sh`: after lint/dispute, a verifier attests provenance.

## Demo narrative

1. Agent A ingests a source → page created (existing).
2. Agent B lints + raises a dispute (existing).
3. **New:** open the Walrus Site, connect a Sui wallet, review a page's sources + lint
   status, click "Attest provenance verified", sign — an attestation object lands in the
   wallet and the page's count increments.
4. Query/trace shows provenance chain (existing); the site shows who attested.

## Testing

- **Move:** unit tests for `attest_provenance` (success + missing-page abort). Keep total
  package tests green.
- **Python:** unit test for the `cortex attest` command argument/flow with `call_move`
  mocked (no network), following the existing `subprocess`-mocked test style.
- **Site:** manual/Playwright smoke — Verify panel renders, lazy bundle loads on click,
  connect-wallet button appears. Wallet signing itself is manual in demo.
- **E2E:** extend `scripts/demo_e2e.sh` with the attest step (CLI path, no browser).

## Open items for the implementation plan

- Locate and record the `UpgradeCap` id; confirm `sui client upgrade` path before any
  republish.
- Choose bundler (esbuild vs Vite) for the site island; keep it minimal.
- Decide event-query RPC endpoint + graceful fallback when RPC is unavailable.
