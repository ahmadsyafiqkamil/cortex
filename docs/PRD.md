# PRD — Cortex
## Decentralized Knowledge Layer untuk AI Agents

| | |
|---|---|
| **Versi** | 1.0 — 12 Juni 2026 |
| **Owner** | Ahmad Syafiq Kamil |
| **Target** | Sui Overflow 2026 — Track Walrus ($70.000) |
| **Deadline submission** | 21 Juni 2026 (9 hari) |
| **Status** | Draft untuk eksekusi |

---

## 1. Ringkasan Eksekutif

Cortex adalah knowledge base terdesentralisasi yang dipelihara oleh AI agents: pola **LLM Wiki Karpathy** (raw sources → wiki markdown ter-interlink → schema) dibangun di atas **Walrus** (storage content-addressed yang immutable) dengan **Sui Move** sebagai coordination layer. Setiap halaman wiki adalah blob Walrus yang immutable; objek Sui menunjuk versi terbaru dan merekam relasi antar halaman. Hasilnya: pengetahuan yang dikompilasi agent menjadi **dapat diverifikasi asal-usulnya (provenance), portabel antar agent dan platform, serta dapat dikurasi banyak pihak tanpa infrastruktur bersama**.

**Visi jangka panjang:** second brain kolektif — wiki publik yang dibangun banyak orang dan banyak agent, di mana ketidaksepakatan bersifat first-class dan transparan, bukan ditimpa diam-diam.

**Scope hackathon:** primitif minimum yang membuktikan visi itu — provenance, dispute, time travel, dan kurasi dua agent — pada satu domain demo konkret.

---

## 2. Positioning (WAJIB konsisten di semua materi)

> **Cortex menjamin *verifiable provenance*, bukan *verifiable truth*.**

Blockchain tidak bisa mengaudit kebenaran sebuah klaim. Yang bisa diaudit adalah: siapa menulis apa, kapan, dari sumber mana, dan apakah ada pihak yang menyengketakannya. Ini model Wikipedia ("verifiability, not truth") yang dipindahkan ke infrastruktur trustless.

**Satu kalimat diferensiasi vs MemWal:**
> MemWal menyimpan apa yang agent *alami* (episodic memory); Cortex menyimpan apa yang agent *pahami* (compiled, interlinked, disputable knowledge).

**Jawaban siap-pakai untuk "kenapa bukan git?":**
Git memberi history dan hash, tapi membutuhkan remote yang di-host satu pihak dan tidak bisa dibaca oleh smart contract. Cortex dibutuhkan ketika: (a) agent milik pihak berbeda yang tidak saling percaya server siapa pun harus kurasi satu wiki, (b) kontrak on-chain perlu memverifikasi state pengetahuan, (c) wiki harus hidup lebih lama dari maintainer-nya.

---

## 3. Masalah

1. **Agent stateless & terfragmentasi** — konteks hilang antar sesi, memory terkunci di satu platform/model/vendor.
2. **Pengetahuan agent tidak bisa diaudit** — jawaban RAG tidak punya jejak: dari sumber mana, versi kapan, siapa yang menulis.
3. **Tidak ada koordinasi multi-agent tanpa trust** — dua agent dari organisasi berbeda tidak bisa memelihara satu knowledge base tanpa server bersama milik salah satu pihak.
4. **Pola Karpathy berhenti di lokal** — LLM Wiki yang viral (April 2026) hanya markdown di disk: tidak verifiable, tidak portabel, tidak kolaboratif lintas pihak.

---

## 4. Pengguna & Use Case

### Persona utama (demo)
**Tim riset kebijakan / unit layanan publik** yang agen-agennya mengkompilasi regulasi dan kasus dari banyak sumber, dan hasilnya harus bisa dipertanggungjawabkan (setiap klaim tertelusur ke dokumen sumber).

**Domain demo: knowledge base regulasi & prosedur perlindungan PMI/WNI** (alternatif cadangan: ekonomi pesantren). Alasan: konkret, dikuasai owner, tidak akan ditiru tim lain, dan langsung menjawab kriteria juri "Real-World Application" (bobot 50%).

### Persona sekunder (narasi visi)
- Developer agent yang butuh shared memory layer antar framework.
- Komunitas yang membangun public-good wiki (DAO-curated) — *visi, bukan scope build*.

---

## 5. Solusi & Arsitektur

```
┌────────────────────────────────────────────────────────┐
│ UI: Walrus Site (wiki publik + graph view + diff view) │
├────────────────────────────────────────────────────────┤
│ Agents (off-chain, Python + Gemini 2.5 Flash):          │
│   ingest │ query │ lint │ (agent ke-2 untuk demo)       │
├────────────────────────────────────────────────────────┤
│ Sui Move (coordination):                                │
│   Wiki (shared object) + WikiOwnerCap / ContributorCap │
│   PageRecord via dynamic fields                        │
│   Dispute object │ Move events untuk link & history    │
├────────────────────────────────────────────────────────┤
│ Walrus (storage): page blobs │ raw source blobs │schema│
└────────────────────────────────────────────────────────┘
```

**Prinsip desain kunci:**
- Blob ID Walrus bersifat deterministik dari konten → blob ID = identitas versi halaman. Versi baru = blob baru; Sui object memutakhirkan pointer; history tidak pernah hilang.
- Raw sources immutable, tidak pernah diedit (pola Karpathy) → provenance selalu menunjuk ke sumber manusia/eksternal, **bukan ke tulisan agent lain** (pertahanan terhadap feedback loop / model collapse).
- Graph antar halaman direkam sebagai **Move events** (bukan struktur on-chain penuh) → murah, cukup untuk graph view, hemat waktu build.

---

## 6. Fitur

### P0 — Wajib ada untuk submission (MVS)

| # | Fitur | Deskripsi | Acceptance criteria |
|---|---|---|---|
| F1 | **Move package: Cortex core** | `Wiki` shared object; `WikiOwnerCap` & `ContributorCap` (capability pattern); `PageRecord` via dynamic fields (`name → {latest_blob_id, prev_blob_ids: vector, sources: vector}`); fungsi `create_wiki`, `add_page`, `update_page`, `register_source`; event `LinkAdded`, `PageUpdated` | Deployed ke Sui testnet, Package ID tercatat; semua fungsi teruji via CLI |
| F2 | **Ingest agent** | `cortex ingest <url/file>`: simpan raw source ke Walrus → ekstrak konsep (Gemini) → tulis/update page blobs (markdown + frontmatter YAML berisi `sources: [blob_id]` per klaim) → update pointer on-chain → update index & log | 1 sumber menghasilkan ≥1 halaman baru + update ≥1 halaman lama + entri log; semua blob ID valid |
| F3 | **Query agent** | `cortex query "..."`: baca index → baca halaman relevan dari Walrus → jawab dengan sitasi `[page → source blob ID]` | Jawaban memuat sitasi yang bisa ditelusuri sampai raw blob |
| F4 | **Verifiable provenance** | Setiap klaim di halaman wajib menunjuk blob ID sumber; UI menampilkan rantai klaim → halaman → blob → raw source | Demo klik-tembus dari satu klaim sampai konten sumber mentah |
| F5 | **Walrus Site** | Wiki dirender sebagai situs statis publik (halaman + daftar sumber + link Sui Explorer per objek) | URL publik bisa diakses; site object ID tercatat |

### P1 — Pembeda untuk menang (target shortlist)

| # | Fitur | Deskripsi |
|---|---|---|
| F6 | **Dispute primitive** | Siapa pun (dengan `ContributorCap`) bisa melampirkan `Dispute` object pada klaim: menunjuk halaman + counter-source blob ID. UI menandai klaim tersengketa. Sengketa tidak menghapus apa pun — disagreement bersifat transparan |
| F7 | **Confidence score** | Jumlah sumber independen yang mendukung tiap klaim, dihitung dari metadata on-chain. Bukan klaim kebenaran — sinyal yang bisa diaudit |
| F8 | **Time travel** | `cortex snapshot <timestamp>` merekonstruksi wiki dari chain of blob IDs; UI diff antar dua snapshot |
| F9 | **Demo dua agent** | Agent A (ingest, identitas/keypair 1) dan Agent B (lint + dispute, keypair 2) bekerja pada wiki yang sama tanpa server bersama — koordinasi murni via Sui |
| F10 | **Lint agent** | `cortex lint`: deteksi broken `[[wikilink]]` (target blob tidak terdaftar), orphan pages (tanpa inbound link dari event index), dan klaim tanpa sumber |

### P2 — Dicoret dari scope hackathon (eksplisit)

- ❌ Plugin Obsidian/VSCode
- ❌ Enkripsi Seal / private pages
- ❌ Sistem reputasi, voting DAO, tokenomics
- ❌ Full graph object on-chain (diganti events)
- ❌ Cross-wiki linking antar owner berbeda
- ❌ Resolusi sengketa otomatis (sengketa hanya *direkam*, tidak di-settle)

---

## 7. Non-Goals

1. **Bukan oracle kebenaran.** Cortex tidak menilai benar/salah; ia merekam asal-usul dan ketidaksepakatan.
2. **Bukan pengganti MemWal** — komplemen di layer berbeda (structured vs episodic).
3. **Bukan general-purpose file storage** — nilai tambahnya di knowledge layer, bukan blob storage.

---

## 8. Demo Video (5 menit) — urutan WAJIB

> Dibuka dengan skenario multi-pihak, BUKAN personal wiki — untuk mematikan pertanyaan "kenapa bukan git" sejak detik pertama.

| Waktu | Konten |
|---|---|
| 0:00–0:40 | Problem: dua organisasi (mis. dua kantor layanan) butuh satu knowledge base PMI yang sama-sama bisa dipercaya — tanpa server milik salah satu pihak, dan setiap klaim harus tertelusur |
| 0:40–1:40 | Agent A ingest 3 sumber (regulasi/SOP) → terminal + Sui Explorer + wiki tumbuh di Walrus Site |
| 1:40–2:30 | Agent B (keypair berbeda) lint wiki yang sama, menemukan klaim lemah, melampirkan **Dispute** dengan counter-source → klaim tertanda di UI |
| 2:30–3:20 | Query dengan sitasi → klik-tembus provenance: klaim → halaman → blob ID → raw source |
| 3:20–4:10 | Time travel: snapshot sebelum vs sesudah dispute, diff ter-track |
| 4:10–5:00 | Visi: second brain kolektif — "Wikipedia membuktikan pengetahuan kolektif tidak butuh oracle kebenaran, hanya provenance transparan + sengketa terbuka. Cortex membawa mekanisme itu ke agent economy" |

---

## 9. Alignment dengan Judging Criteria

| Kriteria | Bobot | Cara Cortex menjawab |
|---|---|---|
| Real-World Application | 50% | Domain demo konkret (PMI/konsuler), persona jelas, masalah audit pengetahuan nyata |
| Product & UX | 20% | Walrus Site publik, graph view, klik-tembus provenance, diff view |
| Technical Implementation | 20% | Move objects + dynamic fields + capability pattern + events; content-addressing Walrus dipakai sebagai fitur inti (bukan tempelan) |
| Presentation & Vision | 10% | Narasi second brain kolektif + positioning jujur (provenance, bukan truth) |

**Syarat track:** "Walrus sebagai verifiable data & memory layer" terpenuhi secara harfiah — Walrus adalah satu-satunya tempat konten hidup; Sui hanya pointer & koordinasi.

---

## 10. Tech Stack

| Layer | Pilihan | Catatan |
|---|---|---|
| Storage | Walrus testnet | `walrus store --epochs max --context testnet` |
| Contract | Sui Move (testnet) | 1 package, ±4 module kecil |
| Agent LLM | Gemini 2.5 Flash | Murah, cepat; prompt ekstraksi konsep + penulisan halaman |
| Agent & CLI | Python 3.11 + typer | `ingest`, `query`, `lint`, `snapshot`, `dispute` |
| SDK on-chain | Sui TypeScript SDK *atau* `sui client` via subprocess | Pilih yang tercepat jalan di hari 3 |
| Site | Static generator ringan (Eleventy) + Cytoscape.js untuk graph | Deploy via `site-builder deploy --epochs max` |

---

## 11. Rencana 9 Hari (dengan buffer)

| Hari | Tanggal | Fokus | Gate keputusan |
|---|---|---|---|
| 1 | Jum 13/6 | Setup Sui CLI + wallet + Walrus CLI; store/read blob pertama; join TG; tanya Abner (mentor Walrus) validasi ide | Blob tersimpan & terbaca = lanjut |
| 2 | Sab 14/6 | Move: Wiki, Cap, PageRecord, events — skeleton + unit test | — |
| 3 | Min 15/6 | Deploy testnet; CLI bisa create_wiki/add_page end-to-end | **Gate 1:** kalau Move molor, pangkas Dispute object jadi event saja |
| 4 | Sen 16/6 | Ingest agent (F2) + format halaman + index/log | — |
| 5 | Sel 17/6 | Query agent (F3) + provenance metadata (F4) | — |
| 6 | Rab 18/6 | Dispute (F6) + lint (F10) + skenario 2 keypair (F9) | **Gate 2:** kalau telat, F7/F8 turun prioritas |
| 7 | Kam 19/6 | Walrus Site + graph view + diff/time-travel view (F5, F8) | — |
| 8 | Jum 20/6 | **Buffer + polish**: testing end-to-end, README, rekam video, **SUBMIT H-1** | Submit hari ini, bukan besok |
| 9 | Sab 21/6 | Cadangan darurat saja (re-record, fix submission) | — |

---

## 12. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Epoch testnet = 1 hari** → blob expired sebelum Demo Day (20–21 Juli) | Fatal | Store semua blob `--epochs max`; jadwalkan pengecekan & extend H-3 sebelum shortlist dan Demo Day |
| Kurva belajar Move (hari 2–3 molor) | Tinggi | Scope Move sudah minimum; Gate 1; pakai mentor (Jianyi/Mysten, OpenZeppelin untuk pattern Move aman) |
| Crowding: tim lain bawa ide wiki/memory serupa (gist Karpathy viral) | Sedang | Diferensiasi di Dispute + provenance + 2-agent demo + domain konkret — kombinasi yang tidak ada di memory layer generik |
| Juri: "ini git with extra steps" | Sedang | Demo dibuka multi-pihak; jawaban git disiapkan (Bag. 2) |
| Over-claim "verifiable knowledge" | Reputasi | Larangan frasa; selalu "verifiable provenance" |
| Relayer/aggregator publik Walrus down saat rekaman | Rendah | Rekam demo H-2; siapkan aggregator alternatif; semua langkah di-script |
| Feedback loop antar agent (saling kutip) | Konseptual | Provenance hanya boleh menunjuk raw source eksternal, di-enforce oleh lint |

---

## 13. Success Criteria

**MVS (wajib):** F1–F5 jalan end-to-end; repo publik + README; video ≤5 menit; Package ID + Site URL di DeepSurge.

**Target shortlist:** + F6–F10; 5–6 halaman ter-curate rapi dengan ≥10 cross-reference; lint report bersih; dispute & time travel terekam di video.

**Definisi "selesai" per fitur:** bisa didemokan ulang dari nol dengan satu script tanpa intervensi manual.

---

## 14. Pertanyaan Terbuka (putuskan di hari 1–2)

1. SDK on-chain dari Python: TypeScript SDK via subprocess, atau `sui client` CLI langsung? (Tes keduanya 30 menit, pilih yang jalan.)
2. `ContributorCap` untuk Agent B: di-mint oleh owner, atau wiki mode "open contribute" untuk demo? (Cenderung: di-mint owner — lebih sederhana & aman.)
3. Konfirmasi ke mentor Abner: apakah ada overlap rencana roadmap MemWal yang perlu dihindari/di-leverage?
4. Sumber demo PMI: 3 dokumen mana yang dipakai? (Siapkan sebelum hari 4.)

---

## 15. Referensi

- Gist Karpathy LLM Wiki: gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Walrus docs: docs.wal.app · Sites: docs.wal.app/docs/sites
- MemWal: docs.memwal.ai (posisi: komplemen, bukan dependensi)
- Sui Move: docs.sui.io · Move Bootcamp: github.com/MystenLabs/sui-move-bootcamp
- Handbook & brief internal: `sui_overflow_2026_handbook.md`, `cortex_research_brief.md`
