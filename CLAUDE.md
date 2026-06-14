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

- [ ] Environment setup (lihat docs/SETUP.md)
- [ ] Move package deployed ke testnet — Package ID: (belum)
- [ ] Wiki object dibuat — Object ID: (belum)
- [ ] Site live — URL: (belum)

(Update bagian ini setiap kali milestone tercapai agar sesi berikutnya tahu posisi.)
