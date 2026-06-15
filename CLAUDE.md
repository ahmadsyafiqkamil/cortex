# CLAUDE.md — Cortex

## Apa ini

Cortex = decentralized knowledge base yang dipelihara AI agents untuk Sui Overflow 2026 (Track Walrus, $70K). Pola LLM Wiki Karpathy (raw → wiki → schema) di atas Walrus (storage immutable, content-addressed) + Sui Move (coordination layer). Setiap halaman wiki = blob Walrus immutable; Sui object menunjuk versi terbaru.

**Positioning (jangan dilanggar di kode, README, maupun copy apa pun):**
Cortex menjamin **verifiable provenance**, BUKAN "verifiable truth/knowledge". Jangan pernah pakai frasa "verifiable knowledge".

**Deadline submission: 21 Juni 2026. Submit H-1 (20 Juni).**

## Dokumen rujukan (baca sesuai kebutuhan)

- `docs/PRD.md` — scope, fitur P0/P1/P2, kriteria sukses
- `docs/ARCHITECTURE.md` — desain teknis lengkap (Move schema, format halaman, kontrak antar-komponen). **Baca sebelum menulis kode Move atau agent.**
- `docs/TASKS.md` — breakdown task per hari + acceptance criteria
- `docs/SETUP.md` — setup environment dari nol
- `docs/SUI_CLI.md` — quick reference perintah `sui client` (alamat, faucet, publish, call, object)
- `docs/DEMO_SCRIPT.md` — skrip demo 5 menit + acceptance test end-to-end
- `docs/reference/` — handbook hackathon & research brief (read-only, konteks)

## Struktur repo

```
cortex/
├── CLAUDE.md
├── README.md
├── move/cortex/            # Sui Move package
│   ├── Move.toml
│   ├── sources/            # wiki.move, source.move, dispute.move
│   └── tests/
├── agent/                  # Python: agents + CLI
│   ├── cortex_cli/         # typer app: ingest, query, lint, snapshot, dispute
│   ├── chain/              # wrapper pemanggilan sui client / PTB
│   ├── walrus/             # wrapper walrus CLI (store/read)
│   └── llm/                # Gemini prompts & parsing
├── site/                   # Walrus Site (Eleventy + Cytoscape.js)
│   └── dist/               # HANYA folder ini yang di-deploy
├── scripts/                # demo_e2e.sh, extend_blobs.sh
└── docs/
```

## Perintah penting

```bash
# Move (sui >= 1.73 wajib --build-env <testnet|mainnet>)
cd move/cortex && sui move build --build-env testnet
cd move/cortex && sui move test --build-env testnet
sui client publish --gas-budget 100000000        # deploy ke testnet

# Walrus
walrus store <file> --epochs max --context testnet
walrus read <blob_id> --context testnet

# Agent CLI
cd agent && python -m cortex_cli ingest <url|file>
cd agent && python -m cortex_cli query "..."
cd agent && python -m cortex_cli lint

# Site
cd site && npx @11ty/eleventy                    # build ke dist/
site-builder --context=testnet deploy --epochs max site/dist

# Demo end-to-end (acceptance test utama)
bash scripts/demo_e2e.sh
```

## Aturan keras (HARUS dipatuhi)

1. **Semua `walrus store` WAJIB `--epochs max`.** Epoch testnet = 1 hari; tanpa ini blob hilang sebelum Demo Day (20–21 Juli).
2. **Raw sources immutable.** Tidak pernah diedit setelah disimpan. Provenance hanya boleh menunjuk blob raw source (eksternal/manusia), TIDAK BOLEH menunjuk halaman wiki lain — ini pertahanan terhadap feedback loop antar agent, dan di-enforce oleh lint.
3. **Identitas on-chain:** Agent A (ingest) dan Agent B (lint/dispute) pakai keypair Sui BERBEDA. Jangan disatukan demi kemudahan — demo dua-pihak adalah pembeda utama proyek ini.
4. **Versi halaman tidak pernah dihapus.** Update = blob baru + push blob lama ke history. Tidak ada operasi delete; "deleted" = soft-delete (flag di PageRecord).
5. **Deploy site hanya dari `site/dist/`**, jangan pernah dari root (node_modules ikut terupload dan bayar per byte).
6. **Scope discipline:** fitur P2 di PRD (Seal, plugin Obsidian, reputasi/DAO, cross-wiki) DILARANG dikerjakan walau terlihat mudah. 9 hari, solo.
7. Jangan hardcode Package ID / object ID — simpan di `agent/.cortex/config.json` (gitignored) dan baca dari situ.
8. Bahasa: kode + komentar + commit message = English. Dokumen user-facing = boleh Indonesia.

## Konvensi kode

- Python 3.11, typer untuk CLI, `subprocess` untuk panggil `sui client` & `walrus` (output JSON: pakai flag `--json` di sui client). Parsing JSON wajib defensif (try/except + pesan error jelas).
- Move: satu module per concern (wiki/source/dispute), capability pattern untuk write access, event untuk semua mutasi. Test minimal per fungsi publik.
- Setiap task selesai → jalankan test terkait + update `docs/TASKS.md` (centang + catatan singkat).

## State proyek saat ini

- [x] Environment setup — sui 1.73.0, walrus 1.50.0, site-builder 2.10.0, Python 3.14 venv, Node 24
- [x] Move package deployed ke testnet — Package ID: `0x823f71d5795240a23e6ae2e7ca195faf93b3a55782f7b3a143f40babc8bf3b7e`
- [x] Wiki object dibuat — Object ID: `0xd55c7cc26ccad850e2b549a5ec88db8983ea732823fc0c60849b1f7891f86755`
- [x] Agent A: `0x6034727b72070c008e8d947d0289915e92fa77630b39d4d7d6fc61fadf0e3e89` — ContributorCap: `0x092b801b4e344f9b8e94bb5a9eb85fd2e35ef8f5224cbdb9aeba338a1307668d`
- [x] Agent B: `0x50126de47be4156ab355685b76eb2fabe94908ea4350fd192727c3c710eeb86a` — ContributorCap: `0x8a4524d942e51a9fe184a4a7ebd86bec6f09d0010b2fb81329d8d93316380c9f`
- [x] Ingest agent — `cortex ingest` end-to-end (7-step pipeline) complete
- [x] Query + trace agent — `cortex query` + `cortex trace` with provenance citations
- [x] Lint agent — 6 checks (broken wikilinks, orphan, claims-without-marker, markers-to-wiki, unregistered sources)
- [x] Dispute — Agent B raise dispute with counter-source
- [x] Demo E2E — `scripts/demo_e2e.sh` (ingest A → lint → dispute B → query)
- [x] Walrus Site — Eleventy build complete (26 pages, graph view, diff, confidence badges)
- [x] Site deployed — Object ID: `0x1e0deb8bd5b9ffa4db7dbf93b0f8fe627813c4ce104d235c51f3ccb624c33e58`
- [x] Site live — URL: `http://qysquom1w51gupfuxenkfw3201fg32dntpmmimxgwxdknw66w.localhost:3000` (portal required)

WikiOwnerCap (Agent A): `0x8d3bb8f4566f1040303385524cb8d8dbe26fc1ab179e4f5dc36c1103fb031d6b`
Explorer: https://suiscan.xyz/testnet/object/0xd55c7cc26ccad850e2b549a5ec88db8983ea732823fc0c60849b1f7891f86755

(Update bagian ini setiap kali milestone tercapai agar sesi berikutnya tahu posisi.)
