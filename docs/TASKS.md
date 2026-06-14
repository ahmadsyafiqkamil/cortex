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

- [ ] **4.1** `agent/walrus/` wrapper (store/read + cache) — uji dengan demo source #1.
- [ ] **4.2** Prompt `extract.md` + parsing JSON defensif; uji terhadap 3 demo sources.
  - ✅ Tiap source menghasilkan ≥2 kandidat halaman dengan klaim ber-quote.
- [ ] **4.3** Prompt `write_page.md` + injeksi blob ID programatik (placeholder `{{SRC}}`).
  - ✅ Output lolos validasi format (frontmatter, marker, wikilink slug kanonis).
- [ ] **4.4** Rangkai `cortex ingest`: alur [1]–[7] di ARCHITECTURE §1, termasuk `_index` & `_log`.
  - ✅ Ingest source #1 end-to-end: blob + on-chain + index ter-update.

## Hari 5 — Selasa 17 Juni · Query agent + provenance

- [ ] **5.1** `cortex query`: index → pilih halaman → baca blob → `answer.md` → jawaban + sitasi.
  - ✅ 3 pertanyaan uji terjawab, semua sitasi blob valid (di-resolve balik sukses).
- [ ] **5.2** Ingest source #2 & #3 → minimal 5 halaman, ≥10 wikilink antar halaman.
- [ ] **5.3** `cortex trace <slug> <claim>`: tampilkan rantai klaim → halaman blob → raw blob → cuplikan sumber (basis demo provenance).

## Hari 6 — Rabu 18 Juni · Lint + Dispute + dua agent  ⚠️ GATE 2

- [ ] **6.1** `cortex lint`: broken wikilink, orphan page, klaim tanpa marker, marker menunjuk halaman wiki (pelanggaran), sumber tak terdaftar. Output report markdown.
- [ ] **6.2** `cortex dispute raise ...` memakai keypair Agent B (register counter-source → raise_dispute).
  - ✅ Dispute object terlihat di explorer; raised_by = alamat B ≠ A.
- [ ] **6.3** Skenario dua-agent ter-script: `scripts/demo_e2e.sh` menjalankan ingest (A) → lint (B) → dispute (B) → query dari mesin/identitas B.
- **GATE 2:** Jika molor → `[-]` confidence score & diff view (7.3, 7.4); time travel cukup CLI tanpa UI.

## Hari 7 — Kamis 19 Juni · Walrus Site

- [ ] **7.1** Eleventy build: fetch data (RPC + aggregator) → render halaman + daftar sumber + link explorer + badge dispute.
- [ ] **7.2** Graph view Cytoscape.js dari events LinkAdded.
- [ ] **7.3** Confidence badge per klaim (jumlah sumber unik).
- [ ] **7.4** Diff/time-travel view (2 versi blob dari history).
- [ ] **7.5** Deploy: `site-builder --context=testnet deploy --epochs max site/dist`. Catat Site object ID + URL portal di CLAUDE.md.
  - ✅ URL bisa dibuka dari perangkat lain.

## Hari 8 — Jumat 20 Juni · Buffer + SUBMIT (H-1)

- [ ] **8.1** Jalankan `demo_e2e.sh` dari clean state — perbaiki semua yang patah.
- [ ] **8.2** README: pitch (pakai positioning Bag. 2 PRD), arsitektur ringkas, cara jalan, Package ID, Site URL, jawaban "kenapa bukan git".
- [ ] **8.3** Logo 1:1 (sederhana saja) + deskripsi DeepSurge.
- [ ] **8.4** Rekam video ≤5 menit per `docs/DEMO_SCRIPT.md` (2–3 take), upload YouTube.
- [ ] **8.5** **SUBMIT di DeepSurge hari ini.** Verifikasi semua field + repo publik.
- [ ] **8.6** Jadwalkan reminder extend blob: H-3 sebelum 8 Juli & sebelum 20 Juli (`scripts/extend_blobs.sh`).

## Hari 9 — Sabtu 21 Juni · Darurat saja

- [ ] **9.1** Kosong by design. Hanya untuk re-record / perbaikan submission jika ada masalah.

---

## Pasca-submission (sebelum Demo Day 20–21 Juli)

- [ ] **P.1** H-3 shortlist (5 Juli): cek semua blob masih hidup, site masih render, jalankan e2e.
- [ ] **P.2** Jika shortlisted: siapkan live demo + slide pitch; latihan 2x.
- [ ] **P.3** Evaluasi deploy mainnet (struktur hadiah: 100% upfront jika sudah mainnet saat pengumuman 27 Agustus).
