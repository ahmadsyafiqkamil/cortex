# ARCHITECTURE.md — Cortex

Desain teknis untuk implementasi. Melengkapi `PRD.md` (scope & alasan) — dokumen ini menjawab *bagaimana*.

---

## 1. Alur data end-to-end

```
INGEST
  url/file
    → [1] simpan raw source ke Walrus        → raw_blob_id
    → [2] register_source on-chain            → event SourceRegistered
    → [3] Gemini: ekstrak konsep & klaim      → draft halaman (markdown)
    → [4] simpan tiap halaman ke Walrus       → page_blob_id (baru)
    → [5] add_page / update_page on-chain     → pointer mutakhir + history
    → [6] add_link per [[wikilink]]           → event LinkAdded
    → [7] update index.md & log.md            → blob baru + update pointer

QUERY
  pertanyaan
    → baca PageRecord index dari chain (RPC, gratis, tanpa tx)
    → baca index.md dari Walrus → pilih halaman relevan
    → baca page blobs → Gemini sintesis jawaban
    → jawaban + sitasi [halaman → raw_blob_id]

LINT (Agent B, keypair berbeda)
    → enumerasi PageRecord + events via RPC
    → cek: broken [[wikilink]], orphan page, klaim tanpa sumber,
      provenance yang menunjuk halaman wiki (DILARANG)
    → temuan serius → raise_dispute on-chain

SITE
    → generator membaca chain (RPC) + Walrus (aggregator HTTP)
    → render: halaman, daftar sumber, badge dispute, graph view, diff view
```

Prinsip: **Walrus = satu-satunya tempat konten hidup. Sui = pointer, identitas, koordinasi, sengketa.** Tidak ada konten di on-chain storage selain metadata kecil (nama, blob ID, alamat).

---

## 2. Desain Move package

Package: `cortex` — tiga module: `wiki`, `source`, `dispute`.

### 2.1 `cortex::wiki`

```move
module cortex::wiki {
    // === Structs ===

    /// Shared object — siapa pun bisa BACA via RPC; tulis butuh capability.
    public struct Wiki has key {
        id: UID,
        name: String,
        owner: address,
        page_count: u64,
        created_at_ms: u64,
        // PageRecord disimpan sebagai dynamic field di UID ini:
        //   key  : String (nama halaman, kanonis: lowercase-kebab)
        //   value: PageRecord
    }

    /// Capability owner — dipegang pembuat wiki. Bisa mint ContributorCap.
    public struct WikiOwnerCap has key, store {
        id: UID,
        wiki_id: ID,
    }

    /// Capability kontributor — boleh add/update page & raise dispute.
    public struct ContributorCap has key, store {
        id: UID,
        wiki_id: ID,
    }

    /// Nilai dynamic field per halaman.
    public struct PageRecord has store {
        latest_blob: String,          // Walrus blob ID (base64-url) versi terbaru
        history: vector<String>,      // blob ID versi-versi sebelumnya, urut lama→baru
        sources: vector<String>,      // raw source blob IDs yang dikutip versi terbaru
        updated_at_ms: u64,
        updated_by: address,
        deleted: bool,                // soft-delete; konten tidak pernah hilang
    }

    // === Events (sumber data untuk graph & time travel di off-chain) ===
    public struct WikiCreated  has copy, drop { wiki_id: ID, name: String, owner: address }
    public struct PageUpdated  has copy, drop {
        wiki_id: ID, page: String, new_blob: String,
        prev_blob: String,            // "" jika halaman baru
        author: address, timestamp_ms: u64,
    }
    public struct LinkAdded    has copy, drop { wiki_id: ID, from_page: String, to_page: String }

    // === Functions (signature; body diimplementasikan di hari 2–3) ===

    /// Share Wiki, transfer WikiOwnerCap ke sender. Emit WikiCreated.
    public fun create_wiki(name: String, clock: &Clock, ctx: &mut TxContext);

    /// Hanya pemegang OwnerCap yang wiki_id-nya cocok.
    public fun mint_contributor_cap(
        cap: &WikiOwnerCap, wiki: &Wiki, recipient: address, ctx: &mut TxContext
    );

    /// Tambah halaman baru. Abort jika nama sudah ada (E_PAGE_EXISTS)
    /// atau cap.wiki_id != wiki id (E_WRONG_WIKI).
    public fun add_page(
        cap: &ContributorCap, wiki: &mut Wiki,
        page: String, blob: String, sources: vector<String>,
        clock: &Clock, ctx: &mut TxContext
    );

    /// Update: push latest_blob lama ke history, set blob baru. Emit PageUpdated.
    public fun update_page(
        cap: &ContributorCap, wiki: &mut Wiki,
        page: String, new_blob: String, sources: vector<String>,
        clock: &Clock, ctx: &mut TxContext
    );

    /// Soft delete (set deleted = true). Hanya OwnerCap.
    public fun archive_page(cap: &WikiOwnerCap, wiki: &mut Wiki, page: String, ...);

    /// Rekam edge graph. Murni emit event — TIDAK menyimpan state.
    /// Keputusan desain: graph dari events + RPC queryEvents, bukan struktur on-chain.
    public fun add_link(
        cap: &ContributorCap, wiki: &Wiki, from_page: String, to_page: String
    );

    // === Error codes ===
    // E_WRONG_WIKI = 0; E_PAGE_EXISTS = 1; E_PAGE_NOT_FOUND = 2; E_NOT_OWNER = 3;
}
```

**Catatan implementasi:**
- `Clock` = `sui::clock::Clock`, dilewatkan `&Clock` dengan object `0x6`.
- Dynamic fields: `sui::dynamic_field::{add, borrow, borrow_mut, exists_}` dengan key `String`.
- Blob ID disimpan sebagai `String` (representasi base64-url dari Walrus), bukan bytes — menyederhanakan CLI & site.

### 2.2 `cortex::source`

```move
module cortex::source {
    /// Disimpan sebagai dynamic field di Wiki.id dengan prefix key "src:" + blob_id.
    public struct SourceRecord has store {
        blob: String,            // raw source blob ID di Walrus
        title: String,
        origin_url: String,      // URL asal (boleh kosong utk file lokal)
        added_by: address,
        added_at_ms: u64,
    }

    public struct SourceRegistered has copy, drop {
        wiki_id: ID, blob: String, title: String, added_by: address
    }

    public fun register_source(
        cap: &ContributorCap, wiki: &mut Wiki,
        blob: String, title: String, origin_url: String,
        clock: &Clock, ctx: &mut TxContext
    );

    /// View helper untuk validasi on-chain ringan:
    public fun source_exists(wiki: &Wiki, blob: String): bool;
}
```

**Keputusan:** `add_page`/`update_page` TIDAK memvalidasi bahwa setiap entri `sources` sudah terdaftar (hemat gas & kompleksitas). Validasi penuh = tugas lint agent. (Opsional P1+: assert `source_exists` untuk entri pertama saja.)

### 2.3 `cortex::dispute`

```move
module cortex::dispute {
    /// Shared object berdiri sendiri — bisa dibuat siapa pun yang punya ContributorCap.
    /// Dispute TIDAK mengubah halaman. Hanya merekam ketidaksepakatan secara permanen.
    public struct Dispute has key {
        id: UID,
        wiki_id: ID,
        page: String,
        claim_excerpt: String,        // kutipan klaim yang disengketakan (≤ 200 char)
        counter_source_blob: String,  // raw source tandingan (WAJIB sudah ter-register)
        rationale_blob: String,       // markdown penjelasan, disimpan di Walrus ("" boleh)
        raised_by: address,
        raised_at_ms: u64,
        status: u8,                   // 0=open (satu-satunya status di scope hackathon)
    }

    public struct DisputeRaised has copy, drop {
        dispute_id: ID, wiki_id: ID, page: String, raised_by: address
    }

    /// Abort E_SOURCE_NOT_REGISTERED jika counter_source belum terdaftar di wiki —
    /// memaksa penyengketa membawa bukti, bukan sekadar keberatan.
    public fun raise_dispute(
        cap: &ContributorCap, wiki: &Wiki,
        page: String, claim_excerpt: String,
        counter_source_blob: String, rationale_blob: String,
        clock: &Clock, ctx: &mut TxContext
    );
}
```

### 2.4 Test minimum (move/cortex/tests/)

1. `create_wiki` → Wiki shared, OwnerCap dimiliki sender.
2. `add_page` lalu `update_page` → history berisi blob lama, latest = blob baru.
3. `add_page` dengan nama duplikat → abort `E_PAGE_EXISTS`.
4. Cap dari wiki lain → abort `E_WRONG_WIKI`.
5. `raise_dispute` dengan counter_source belum ter-register → abort.
6. `raise_dispute` valid → Dispute shared + event ter-emit.

---

## 3. Format halaman wiki (blob Walrus)

Markdown + YAML frontmatter. Kanonis, di-generate agent, divalidasi lint.

```markdown
---
title: Prosedur Pemulangan PMI Bermasalah
slug: prosedur-pemulangan-pmi          # = key dynamic field on-chain
tags: [pmi, prosedur, konsuler]
sources:                                # SEMUA raw blob yang dikutip halaman ini
  - blob: "M5fW...rA"                   # walrus blob id
    title: "Permenlu No. X/2024"
created: 2026-06-16
---

# Prosedur Pemulangan PMI Bermasalah

PMI yang kehilangan dokumen dapat mengajukan SPLP melalui perwakilan
RI terdekat ^[blob:M5fW...rA]. Proses verifikasi memerlukan ...
^[blob:M5fW...rA]

Lihat juga [[syarat-penerbitan-splp]] dan [[daftar-perwakilan-ri]].
```

**Aturan sintaks:**
- Provenance marker: `^[blob:<walrus_blob_id>]` — menempel pada klaim faktual. Satu klaim boleh punya >1 marker (dasar confidence score).
- Wikilink: `[[slug]]` — slug kanonis lowercase-kebab, harus cocok dengan key on-chain.
- Marker DILARANG menunjuk blob halaman wiki — lint menolak (anti feedback-loop).

**Dua file sistem (juga blob, pola Karpathy):**
- `index.md` — katalog: tiap halaman = baris `slug | ringkasan 1 kalimat | jml sumber`. Pointer on-chain sebagai halaman bernama `_index`.
- `log.md` — append-only, format `## [2026-06-16T09:30Z] ingest | <judul> | by <addr>`. Halaman `_log`.

---

## 4. Kontrak antar-komponen

### 4.1 `agent/walrus/` (wrapper)
```
store(path) -> blob_id          # walrus store <path> --epochs max --context testnet
read(blob_id) -> bytes          # walrus read; fallback: GET aggregator HTTP
```
Parsing output CLI walrus defensif; simpan mapping blob→file lokal di `.cortex/cache/`.

### 4.2 `agent/chain/` (wrapper)
```
call(fn, args, keypair) -> tx_digest, created_objects
  # sui client call --package <PKG> --module <mod> --function <fn> --args ... --json
get_page(wiki_id, slug) -> PageRecord       # via suix_getDynamicFieldObject (RPC, no tx)
list_pages(wiki_id) -> [slug]               # suix_getDynamicFields (paginated)
query_events(type) -> [event]               # suix_queryEvents (LinkAdded, PageUpdated, ...)
```
Keypair: `--client.config` atau env `SUI_CONFIG`; Agent A dan B = alamat berbeda (lihat SETUP.md).

### 4.3 Identitas konfigurasi (`agent/.cortex/config.json`, gitignored)
```json
{
  "network": "testnet",
  "package_id": "0x...",
  "wiki_id": "0x...",
  "agent_a": { "address": "0x...", "contributor_cap": "0x..." },
  "agent_b": { "address": "0x...", "contributor_cap": "0x..." },
  "gemini_model": "gemini-2.5-flash"
}
```

### 4.4 Prompt Gemini (agent/llm/)
- `extract.md` — input: teks raw source; output: JSON `{pages: [{slug, title, claims: [{text, quote_span}], links: [slug]}]}`. Suhu rendah, JSON only.
- `write_page.md` — input: JSON klaim + halaman lama (jika update); output: markdown sesuai format Bag. 3. WAJIB menyertakan marker `^[blob:...]` per klaim — blob id di-inject oleh kode (LLM tidak mengarang blob id; placeholder `{{SRC}}` diganti programatik).
- `answer.md` — input: pertanyaan + isi halaman terpilih; output: jawaban + daftar sitasi terstruktur.

**Aturan anti-halusinasi: LLM tidak pernah menghasilkan blob ID. Semua ID di-inject oleh kode.**

### 4.5 Site (site/)
- Build-time data fetch (Node script sebelum Eleventy): RPC → daftar halaman + disputes + events; aggregator → konten blob. Hasil = JSON data files untuk Eleventy.
- Graph view: Cytoscape.js dari events `LinkAdded`.
- Diff view: pilih 2 blob dari `history` → diff teks sisi-sisi (lib `diff` JS).
- Badge merah pada halaman yang punya Dispute open + panel detail (excerpt, counter-source link, alamat penyengketa, link Sui Explorer).
- Setiap entitas on-chain punya link explorer: `https://suiscan.xyz/testnet/object/<id>` (atau suivision).

---

## 5. Time travel & confidence (implementasi)

- **Time travel:** rekonstruksi = ambil `history` + `latest_blob` per halaman + timestamp dari events `PageUpdated`; snapshot(T) = blob terakhir per halaman dengan timestamp ≤ T. Murni off-chain dari data on-chain.
- **Confidence score:** per klaim = jumlah marker `^[blob:...]` dengan blob unik & terdaftar. Ditampilkan sebagai badge kecil (1 sumber / 2+ sumber). Tanpa klaim ML apa pun.

---

## 6. Keputusan desain yang sudah final (jangan dibuka ulang)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Graph storage | Events, bukan on-chain struct | Hemat 1–2 hari; cukup untuk graph view |
| Validasi sumber | Di lint (off-chain), bukan kontrak | Gas & kompleksitas; dispute tetap divalidasi on-chain |
| Blob ID type | `String` | Interop CLI/site sederhana |
| Wiki | Shared object + capability | Baca publik gratis via RPC, tulis terkontrol |
| Delete | Soft-delete flag | Storage immutable; history = fitur |
| SDK | `sui client --json` via subprocess | Tercepat untuk solo 9 hari; TS SDK hanya jika subprocess bermasalah (putuskan Hari 3, lihat TASKS.md) |
