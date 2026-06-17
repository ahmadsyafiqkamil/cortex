# VIDEO_SCRIPT.md — Cortex Demo Submission

**Duration:** ≤ 5:00 | **Audio language:** English
**Forbidden phrase:** "verifiable knowledge" — always replace with "verifiable provenance"

---

## Timeline

```
0:00 ━━━ 0:40 ━━━ 1:45 ━━━ 2:35 ━━━ 3:10 ━━━ 3:35 ━━━ 4:10 ━━━ 5:00
   Scene 0   Scene 1   Scene 2   Scene 3    Scene3.5   Scene 4   Scene 5
   (40s)     (65s)     (50s)     (35s)      (25s)      (35s)     (50s)
```

---

## Scene 0 — Problem (0:00–0:40)

**Visual:** Static diagram slide — two offices (left: "Embassy A", right: "Consulate B") pointing to one knowledge base in the center labeled "CORTEX", with Walrus + Sui icons below. Dark background.

**Voiceover:**

> Imagine two organizations — say, an Embassy and a Consulate — serving migrant workers from different offices. Both need one shared regulatory knowledge base. But they won't depend on each other's server. And every claim must be traceable to its source document — otherwise, how do you trust it?
>
> AI agents can now maintain wikis like this — what's called the Karpathy LLM Wiki pattern. But the output is locked on local disk: not verifiable, not portable, not collaboratively curatable.
>
> Cortex moves that pattern onto Walrus and Sui. Every page is an immutable blob stored on Walrus. Sui holds pointers, identity, and coordination. And disagreements — recorded openly as first-class citizens.

---

## Scene 1 — Ingest by Agent A (0:40–1:45)

**Visual:** Split screen — left: terminal with `cortex ingest` CLI output, right: browser showing the Walrus Site with pages growing in real-time. Large terminal font, high contrast.

**In terminal (progressive):**
```bash
cortex ingest demo-sources/source1.txt
# output: raw_blob_id, 5 pages created, 3 updated, tx digest
cortex ingest demo-sources/source2.txt
# output: 5 new pages, wikilinks detected
cortex ingest demo-sources/source3.txt
# output: 9 pages, 81 total wikilinks on-chain
```

**In browser (appears after first ingest):**
- Home page: page list grows (start 0 → 10 → 26).
- Graph view: nodes appear, edges form between nodes.
- Click a page: markdown content + provenance markers.

**Voiceover:**

> Agent A — this could be organization one — runs `cortex ingest` on three source documents: migrant worker protection regulations, travel document issuance SOP, and consular guidelines.
>
> Watch what happens. Each source is first stored as a Walrus blob — content-addressed, immutable, with a deterministic blob ID. Then the LLM extracts concepts, writes wiki pages in markdown with provenance markers — `^[blob:...]` markers pointing to source documents. Pages are stored again to Walrus as new blobs, and Sui updates the on-chain pointer.
>
> No database. No server. Content lives on Walrus. Sui only coordinates.

---

## Scene 2 — Agent B Lint & Dispute (1:45–2:35)

**Visual:** Terminal switches — show `sui client active-address` now pointing to Agent B (different address). Run lint, then dispute. Browser shows page with red dispute badge.

**In terminal:**
```bash
sui client active-address
# 0x5012...eeb86a  ← Agent B, different from Agent A

cortex lint
# output: 6 checks, 0 errors, X orphan pages, Y claims without markers

cortex dispute raise \
  --page prosedur-pemulangan-pmi \
  --counter-source demo-sources/counter-pemulangan-jenazah.txt \
  --rationale "This procedure needs updating based on the latest circular"
# output: counter-source stored → registered → dispute object created → tx digest
```

**In browser:**
- Open page `prosedur-pemulangan-pmi` — red "DISPUTED" badge appears.
- Click badge → dispute panel: `raised_by: 0x5012...` (different from page author), excerpt, counter-source link, rationale.
- Explorer: dispute object as a shared on-chain object.

**Voiceover:**

> Now Agent B. This is a different Sui keypair — organization two, a different party. No shared server. Pure blockchain coordination.
>
> Agent B runs `cortex lint` — six quality checks: broken wikilinks, orphan pages, unsourced claims. Then Agent B finds a claim on the repatriation procedures page that needs updating. They run `cortex dispute raise` with a counter-source — the latest circular document.
>
> Look: The dispute is recorded as an on-chain object. `raised_by` points to Agent B's address — different from the page author. On the site, the page gets a red badge. Disputes don't delete content — disagreement is a first-class citizen in Cortex.

---

## Scene 3 — Query + Click-Through Provenance (2:35–3:10)

**Visual:** Terminal query + trace → browser showing page with provenance chain.

**In terminal:**
```bash
cortex query "What are the requirements for SPLP issuance for a PMI who lost their passport?"
# output: answer with citations [page → raw_blob_id]

cortex trace syarat-penerbitan-splp "SPLP is issued by the Indonesian representative"
# output: chain: claim → page blob → raw source blob → excerpt from original document
```

**In browser (cursor highlight is critical here):**
- Cursor moves from claim on page → clicks provenance marker → opens raw source blob via aggregator URL → displays original source document text.
- Show that the `^[blob:...]` marker is embedded in the text, not generated at query time.

**Voiceover:**

> Now we query: "What are the requirements for SPLP issuance for a PMI who lost their passport?" The answer comes with full citations — every claim points to a source blob ID.
>
> But here's the key: `cortex trace`. We trace one specific claim: "SPLP is issued by the Indonesian representative." Trace shows the complete chain: claim → wiki page → page blob ID → raw source blob ID → and finally, the original text from the source document.
>
> Cortex doesn't claim this statement is true. It proves this claim came from this document, this version, unchanged. Verifiable provenance — not verifiable truth. The Wikipedia principle, moved to trustless infrastructure.

---

## Scene 3.5 — Ask Cortex (RAG Chat) (3:10–3:35)

**Visual:** Browser — click "ASK" in site nav → chat page. Type a question, see answer bubble + citations. Then type an out-of-domain question.

**In browser (AskCortex page):**
- Type: "What should I do if I lose my passport abroad?"
- Answer bubble appears with response text + `[[syarat-penerbitan-splp]]` citation tags.
- Sources block below: list of clickable blob IDs + source titles.
- Click citation → opens related wiki page.

- Type: "How to cook nasi goreng?"
- Answer: "That isn't in the Cortex knowledge base yet." — refusal, not hallucination.

**Voiceover:**

> Cortex also has RAG chat — "Ask Cortex" — from CLI or web. We ask about passport procedures. The answer isn't generic text — every claim has a clickable citation tag linking to a wiki page. And the sources block below shows real blob IDs from Walrus.
>
> Now try an out-of-domain question: "How to cook nasi goreng?" Refused. No hallucination. Because Cortex only answers from its verified knowledge base.

---

## Scene 4 — Time Travel (3:35–4:10)

**Visual:** On the Walrus Site, open the disputed page `prosedur-pemulangan-pmi`.

**In browser:**
- Scroll to "History" panel — show list of blob versions with timestamps.
- Version 1: before dispute (earlier timestamp).
- Version 2: after Agent B raised dispute (newer timestamp).
- Select both versions from dropdown → diff view appears: left side (before), right side (after), differences highlighted (red/green).
- Each version has a link to its blob ID via aggregator — immutable, always readable.

**Voiceover:**

> Time travel. Every page version is permanently stored as an immutable Walrus blob. The history panel shows all versions with on-chain event timestamps.
>
> We can diff any two versions — for example, before and after Agent B filed a dispute. The diff view is built directly from on-chain history stored on Sui — not from a database.
>
> This means: any past knowledge state can be reconstructed. Nobody can silently rewrite history.

---

## Scene 5 — Vision (4:10–5:00)

**Visual:** Closing slide — dark background. Appear in sequence:
- Cortex logo + tagline "Verifiable Provenance for the Agent Economy"
- GitHub URL + Package ID
- Site URL
- "Built on Walrus + Sui for Sui Overflow 2026"

**Voiceover (slower pace, visionary tone):**

> Today we demonstrated one wiki, two agents, one domain — migrant worker protection.
>
> But the primitives we built — mandatory provenance on every claim, open and permanent disputes, immutable history — are the foundation for something bigger.
>
> Imagine a collective second brain: a public wiki built by many people and many agents. Where answers don't need blind trust — because every claim traces back to its source. Where disagreements aren't hidden, but recorded as part of the knowledge itself.
>
> Wikipedia proved that collective knowledge doesn't need an oracle of truth. It needs traceable sources and transparent disagreement.
>
> Cortex brings that mechanism to the agent economy.
>
> This is not storage. This is knowledge substrate.

---

## Closing (5:00)

**Visual:** Black screen with text:
```
CORTEX
github.com/<repo>
Package: 0x823f...3b7e
Site: http://qysqu...localhost:3000

Built for Sui Overflow 2026 — Walrus Track
```

---

## Recording Guidelines

### Before recording
- [ ] Run `scripts/demo_e2e.sh` 2x from clean state — ensure nothing breaks
- [ ] Verify all blobs have `--epochs max` — check `walrus info`
- [ ] Ensure sufficient SUI + WAL balance for Agent A and Agent B
- [ ] Prepare 4 browser tabs: Site Home, Site AskCortex, Sui Explorer (wiki object), blob aggregator URL
- [ ] Terminal: large font (18pt+), dark theme, CLI output visible
- [ ] Full run-through at least 2x — target 4:30, leave 30 second margin

### During recording
- [ ] 1080p, 30fps
- [ ] Mic close, quiet room, pop filter if available
- [ ] Record per scene (6 separate files) — combine during edit
- [ ] Highlight cursor during click-through provenance in Scene 3 (most critical moment)
- [ ] Scene 0 can be recorded separately as voice-over (no live terminal needed)

### During edit
- [ ] Final duration MUST be ≤ 5:00 (hard limit)
- [ ] Transitions between scenes: 0.5 second crossfade
- [ ] Scenes 1–4: add small "Agent A" / "Agent B" overlay in terminal corner
- [ ] Scene 5: soft background music (optional, but don't overpower narration)

### After upload
- [ ] Upload to YouTube as **unlisted**
- [ ] Test playback from incognito window
- [ ] Link video + timestamp entered into DeepSurge form
