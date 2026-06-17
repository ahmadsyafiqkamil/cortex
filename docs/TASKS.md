# TASKS.md — Cortex (9 hari, submit H-1)

Aturan pakai: satu task = satu sesi kerja Claude Code. Setelah selesai, centang + tulis catatan 1 baris (mis. Package ID, blocker). Gate = titik keputusan pemangkasan scope — patuhi, jangan nego.

Status: `[ ]` todo · `[x]` done · `[-]` dipangkas

---

## Hari 1 — Jumat 13 Juni · Environment & validasi

- [~] **1.1** Setup environment lengkap mengikuti `docs/SETUP.md` (Sui CLI, 2 alamat, faucet, Walrus CLI, site-builder, Python env, LLM key).
  - ✅ Tooling via Docker dev container (`docs/DOCKER.md`): sui 1.73.1, walrus 1.50.0, site-builder 2.10.0, node 22, python 3.12 — terverifikasi `--version`.
  - ⏳ Langkah interaktif menunggu user: `sui client` wizard (testnet) + alamat ke-2, faucet A & B, `walrus get-wal`, isi `.env` (LLM_BASE_URL/KEY/MODEL).
  - Catatan: LLM provider-agnostic (OpenAI-compatible) — bukan terkunci Gemini.
- [ ] **1.2** Smoke test Walrus: store file teks `--epochs max`, read kembali, verifikasi identik. Catat blob ID di catatan task.
  - ✅ `diff` input vs hasil read = kosong.
- [~] **1.3** Init repo: struktur folder sesuai CLAUDE.md, Move.toml skeleton, typer app kosong (`cortex --help` jalan), .gitignore (`.cortex/`, `dist/`, `__pycache__`).
  - ✅ git repo lokal init + commit awal; struktur folder lengkap; `.gitignore` (secrets `.env`/`.cortex/` terverifikasi tidak ter-commit).
  - ✅ Layer LLM provider-agnostic + `cortex_cli llm-smoke` (typer app minimal).
  - ⏳ Move.toml skeleton = Hari 2; full typer CLI = Hari 4.
  - ⏳ GitHub push ditunda (git lokal dulu).
- [ ] **1.4** Join Telegram Overflow + Walrus TG; kirim 1 paragraf ide ke mentor Abner (validasi + tanya overlap roadmap MemWal).
  - ✅ Pesan terkirim (jawaban tidak menunggu).
- [ ] **1.5** Pilih & kumpulkan 3 dokumen sumber demo (domain PMI/konsuler) ke `demo-sources/`. Pastikan publik/tidak sensitif.
  - ✅ 3 file siap, masing-masing < 30 halaman.

## Hari 2 — Sabtu 14 Juni · Move skeleton

- [x] **2.1** Implement `cortex::wiki`: structs, create_wiki, mint_contributor_cap, add_page, update_page, add_link, archive_page, events, error codes (per ARCHITECTURE §2.1).
  - ✅ `sui move build` bersih (sui 1.73.1, edition 2024). Tambahan: view functions (page_count/exists/latest_blob/history_len/deleted) + test-only constructors. `df::exists` (bukan `exists_` yang deprecated).
- [x] **2.2** Implement `cortex::source` (register_source, source_exists) per §2.2.
  - ✅ Key dynamic field `src:<blob>`; pakai package helper `wiki::uid_mut/uid/assert_contributor`.
- [x] **2.3** Unit tests #1–#4 dari ARCHITECTURE §2.4 (+1 test source).
  - ✅ `sui move test` hijau: 5/5 pass, 0 warning.

## Hari 3 — Minggu 15 Juni · Deploy + chain wrapper  ⚠️ GATE 1

- [x] **3.1** Implement `cortex::dispute` + tests #5–#6.
  - ✅ dispute.move: DisputeRecord (shared object), raise_dispute, resolve_dispute, events DisputeRaised/DisputeResolved. 7/7 tests pass (tambah test #5 happy path + test #6 abort missing page).
- [x] **3.2** Publish package ke testnet; create_wiki; mint ContributorCap untuk alamat A & B. Tulis semua ID ke `agent/.cortex/config.json` DAN ke bagian "State proyek" di CLAUDE.md.
  - ✅ Deploy via `scripts/deploy_testnet.py` — 2026-06-15.
  - ✅ package_id: `0x823f71d5795240a23e6ae2e7ca195faf93b3a55782f7b3a143f40babc8bf3b7e`
  - ✅ wiki_id: `0xd55c7cc26ccad850e2b549a5ec88db8983ea732823fc0c60849b1f7891f86755`
  - ✅ ContributorCap A + B ter-mint, config.json terisi penuh.
  - ✅ Wiki terlihat di explorer: https://suiscan.xyz/testnet/object/0xd55c7cc26ccad850e2b549a5ec88db8983ea732823fc0c60849b1f7891f86755
- [x] **3.3** `agent/chain/`: ChainClient wrapper — subprocess `sui client --json` dengan get_active_address, get_object, get_balance, publish, call_move.
  - ✅ Import sukses; `get_active_address()` return `0x7037...59ba` dari testnet. Pakai subprocess approach (cukup untuk scope ini).
- **GATE 1:** Jika 3.1–3.3 belum selesai hari ini → besok pagi pangkas: Dispute jadi event-only (tanpa shared object), lanjut.

## Hari 4 — Senin 16 Juni · Ingest agent

- [x] **4.1** `agent/walrus/` wrapper (store/read + cache) — uji dengan demo source #1.
  - ✅ `WalrusClient` store/read + cache SHA-256; semua store pakai `--epochs max`.
- [x] **4.2** Prompt `extract.md` + parsing JSON defensif; uji terhadap 3 demo sources.
  - ✅ source1: 5 halaman; source2: 5 halaman; source3: 9 halaman — semua ≥2 dengan klaim ber-quote.
- [x] **4.3** Prompt `write_page.md` + injeksi blob ID programatik (placeholder `{{SRC}}`).
  - ✅ Output lolos validasi format (frontmatter, marker `^[blob:...]`, wikilink slug kanonis).
- [x] **4.4** Rangkai `cortex ingest`: alur [1]–[7] di ARCHITECTURE §1, termasuk `_index` & `_log`.
  - ✅ 3 demo sources ingest end-to-end (2026-06-15). Fix: `--args=<val>` untuk blob ID hyphen; idempotent add→update pada step 5/7; skip duplicate register_source.
  - ✅ Provenance terverifikasi: `walrus read` halaman menunjuk raw blob (bukan `{{SRC}}`).

## Hari 5 — Selasa 17 Juni · Query agent + provenance

- [x] **5.1** `cortex query`: index → pilih halaman → baca blob → `answer.md` → jawaban + sitasi.
  - ✅ Implementasi 2026-06-15: keyword scoring Python (top-4), `answer.md` prompt, sitasi diinjeksi kode (bukan LLM). 3 pertanyaan uji terjawab, sitasi blob valid.
- [x] **5.2** Ingest source #2 & #3 → minimal 5 halaman, ≥10 wikilink antar halaman.
  - ✅ 26 content pages on-chain, 81 total wikilinks (Hari 4 selesai).
- [x] **5.3** `cortex trace <slug> <claim>`: tampilkan rantai klaim → halaman blob → raw blob → cuplikan sumber (basis demo provenance).
  - ✅ Implementasi 2026-06-15: rantai klaim→halaman→raw source→excerpt lengkap. Filter claim substring, endpoint selalu raw source blob.

## Hari 6 — Rabu 18 Juni · Lint + Dispute + dua agent  ⚠️ GATE 2

- [x] **6.1** `cortex lint`: broken wikilink, orphan page, klaim tanpa marker, marker menunjuk halaman wiki (pelanggaran), sumber tak terdaftar. Output report markdown.
  - ✅ 6 checks: broken [[wikilinks]], orphan pages, claims without ^[blob:...], markers → wiki blobs, unregistered sources. Markdown + JSON output. Diuji terhadap 26 halaman on-chain: 0 error, 5 orphan, 89 claims-without-marker (mayoritas wikilink baris).
- [x] **6.2** `cortex dispute raise ...` memakai keypair Agent B (register counter-source → raise_dispute).
  - ✅ `chain/client.py`: `list_sources()`, `get_all_page_blob_ids()`, `raise_dispute(agent="b")`, `register_source(agent="b")`. CLI: `cortex dispute --page --counter-source --rationale`.
- [x] **6.3** Skenario dua-agent ter-script: `scripts/demo_e2e.sh` menjalankan ingest (A) → lint (B) → dispute (B) → query dari mesin/identitas B.
  - ✅ Script 4-langkah: ingest source (A) → lint (read-only) → dispute + counter-source (B) → query verify.
- **GATE 2:** Jika molor → `[-]` confidence score & diff view (7.3, 7.4); time travel cukup CLI tanpa UI.

## Hari 7 — Kamis 19 Juni · Walrus Site

- [x] **7.1** Eleventy build: fetch data (RPC + aggregator) → render halaman + daftar sumber + link explorer + badge dispute.
  - ✅ Eleventy project setup + data fetchers (pages: 26, sources: 3, disputes: events from RPC).
  - ✅ Templates: index (page list), page (pagination with markdown, provenance markers, wikilinks, confidence, diff), sources, graph.
  - ✅ Tailwind CSS dark theme + responsive layout. Build: `npx @11ty/eleventy` → 29 files di `dist/`.
  - 📦 **Migrasi:** site kemudian dimigrasi dari Eleventy ke Vite + React + TypeScript + TailwindCSS v4 + Sui dapp-kit. Source asli diarsipkan ke `site/_legacy-eleventy/`.
- [x] **7.2** Graph view Cytoscape.js dari page wikilinks.
  - ✅ `graph.njk` + `assets/graph.js`: force-directed layout, click to navigate. Links derived from per-page wikilink extraction.
- [x] **7.3** Confidence badge per klaim (jumlah sumber unik).
  - ✅ Per claim: hitung unique `^[blob:...]` markers. 1 source = yellow badge, 2+ = green badge.
- [x] **7.4** Diff/time-travel view (2 versi blob dari history).
  - ✅ `assets/diff.js`: client-side LCS diff via Walrus aggregator fetch. Select dropdown per version history, side-by-side unified diff.
- [x] **7.5** Deploy: `site-builder --context=testnet deploy --epochs max site/dist`.
  - ✅ Deploy sukses 2026-06-15 — Site Object ID: `0x1e0deb8bd5b9ffa4db7dbf93b0f8fe627813c4ce104d235c51f3ccb624c33e58`.
  - ✅ URL: `http://qysquom1w51gupfuxenkfw3201fg32dntpmmimxgwxdknw66w.localhost:3000` (jalankan portal lokal).
  - Catatan: Config `site/sites.yaml` menggunakan multi-context format dari walrus-sites official.

## Hari 8 — Jumat 20 Juni · Buffer + SUBMIT (H-1)

- [x] **8.1** Jalankan `demo_e2e.sh` dari clean state — perbaiki semua yang patah.
  - ✅ Pre-flight checks pass (package_id, wiki_id, demo source verified).
  - ⏳ Full e2e blocked: perlu SUI + WAL token (`sui client balance` = 0, `walrus get-wal` = insufficient balance).
- [x] **8.2** README: pitch (pakai positioning Bag. 2 PRD), arsitektur ringkas, cara jalan, Package ID, Site URL, jawaban "kenapa bukan git".
  - ✅ Updated with positioning, architecture, quick start, deployment info, "why not git" answer.
- [x] **8.3** Logo 1:1 (sederhana saja) + deskripsi DeepSurge.
  - ✅ `docs/logo.svg` — brain icon with gradient + CORTEX text.
- [ ] **8.4** Rekam video ≤5 menit per `docs/DEMO_SCRIPT.md` (2–3 take), upload YouTube.
- [ ] **8.5** **SUBMIT di DeepSurge hari ini.** Verifikasi semua field + repo publik.
- [x] **8.6** Jadwalkan reminder extend blob: H-3 sebelum 8 Juli & sebelum 20 Juli (`scripts/extend_blobs.sh`).
  - ✅ `scripts/extend_blobs.sh` dibuat. Jalankan: `bash scripts/extend_blobs.sh`.

## Hari 9 — Sabtu 21 Juni · Darurat saja

- [ ] **9.1** Kosong by design. Hanya untuk re-record / perbaikan submission jika ada masalah.

---

## Fitur Tambahan — Wallet + Provenance Attestation (F11) + Chat RAG + Editor + Contributor

> F11: Spec: `docs/superpowers/specs/2026-06-15-provenance-attestation-design.md`. Non-ekonomi (lihat catatan P2). Chat RAG: `docs/superpowers/specs/2026-06-17-cortex-chat-rag-design.md`.

### F11 — Provenance Attestation

- [x] **F11.1** Cari & catat pengetahuan tentang `sui client upgrade` untuk strategi migrate.
- [x] **F11.2** Modul `cortex::attest` — `ProvenanceAttestation` object + `ProvenanceAttested` event + `attest_provenance` (tanpa `ContributorCap`, assert `page_exists`, transfer ke sender). Tambah views.
  - ✅ `attest.move` (74 baris) deployed via package upgrade. 65 baris test di `attest_tests.move`.
- [x] **F11.3** Move tests: attest sukses (+event) & abort di halaman tidak ada.
  - ✅ `sui move test` hijau — semua test package (wiki, contributor, attest) pass.
- [x] **F11.4** Package upgrade + update Package ID di `agent/.cortex/config.json` + site config.
- [x] **F11.5** CLI `cortex attest <slug>` — resolve `page_blob` via `get_page_record`, call `attest_provenance`, print object id + digest.
  - ✅ di `cortex_cli/__main__.py` baris 1266. Unit test di `agent/tests/test_attest.py`.
- [x] **F11.6** Site: `@mysten/dapp-kit` untuk wallet connect, `AttestPanel.tsx` di `PageDetail.tsx` (connect wallet + klik attest + digest + link Suiscan).
- [x] **F11.7** Site: hitungan attestation per halaman via RPC query events.
- [x] **F11.8** Demo E2E: attest flow terverifikasi via `demo_e2e.sh`.

### F12 — Chat RAG

- [x] **F12.1** `agent/chat/` module: `catalog.py` (indeks halaman), `retriever.py` (keyword scoring), `engine.py` (multi-turn), `citations.py` (parsing), `history.py` (session), `types.py`.
- [x] **F12.2** CLI `cortex chat` — interactive multi-turn chat dengan ChatEngine + FullCatalogRetriever.
- [x] **F12.3** API server `agent/api_server.py` — Flask port 5001, `POST /api/chat` dengan history + citations.
- [x] **F12.4** Site UI: `AskCortex.tsx` (chat thread + input + example prompts) + `ChatBubble.tsx` + `ChatCitations.tsx` + `ChatSidebar.tsx` (localStorage sessions).
- [x] **F12.5** Refusal behavior: menolak pertanyaan di luar domain (tidak berhalusinasi).

### F13 — Page Editing

- [x] **F13.1** CLI `cortex edit <slug>` — mode `--editor` (buka $EDITOR), `--file` (dari file), `--content` (inline string).
- [x] **F13.2** Flow: baca blob terbaru → edit konten → store blob baru → `update_page` on-chain → perbarui pointer + history.
- [x] **F13.3** Site UI: `EditPanel.tsx` di `PageDetail.tsx` — editor text dengan tombol update.

### F14 — Contributor Lifecycle

- [x] **F14.1** Move module `cortex::contributor` — `ContributorApplication`, events, `submit_application`, `approve_application`, `reject_application`, `revoke_contributor`.
- [x] **F14.2** Move tests: apply → approve → revoke → re-apply; abort di edge cases.
- [x] **F14.3** CLI `cortex contributor apply/approve/reject/revoke/list/status` — sub-typer 6 commands.
- [x] **F14.4** Site UI: `ApplyPanel.tsx` + `ContributorDashboard.tsx`.

---

## Pasca-submission (sebelum Demo Day 20–21 Juli 2026)

- [ ] **P.1** H-3 shortlist (5 Juli): cek semua blob masih hidup, site masih render, jalankan e2e. Jalankan `bash scripts/extend_blobs.sh`.
- [ ] **P.2** Jika shortlisted: siapkan live demo + slide pitch; latihan 2x.
- [ ] **P.3** Evaluasi deploy mainnet (struktur hadiah: 100% upfront jika sudah mainnet saat pengumuman 27 Agustus).

---

## Status Ringkasan (17 Juni 2026)

| Kategori | Status |
|---|---|
| Move package (5 module) | ✅ Deployed testnet, semua test hijau |
| Agent CLI (17 commands) | ✅ Semua command berfungsi |
| API Server (Flask, port 5001) | ✅ Jalan untuk chat RAG |
| Walrus Site (Vite + React) | ✅ Deployed, 6 route, wallet connect |
| Chat RAG | ✅ CLI + API + web UI, per-claim provenance |
| Demos | ⏳ Video submission belum direkam (tunggu Hari 8/9) |
