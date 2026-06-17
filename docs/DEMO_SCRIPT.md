# DEMO_SCRIPT.md — Cortex (video ≤ 5 menit)

Dokumen ini dipakai dua kali: (1) skrip rekaman video submission, (2) acceptance test end-to-end di Hari 8 — semua perintah di bawah harus jalan dari clean state via `scripts/demo_e2e.sh`.

**Prinsip narasi:** buka dengan skenario DUA PIHAK. Jangan pernah membuka dengan "personal wiki" — itu mengundang pertanyaan "kenapa bukan git". Frasa terlarang: "verifiable knowledge". Frasa wajib: "verifiable provenance".

---

## Scene plan

### Scene 0 · 0:00–0:40 — Problem (slide/voice over)

Narasi (±90 kata):
> "Dua organisasi melayani pekerja migran dari kantor berbeda. Keduanya butuh satu knowledge base regulasi yang sama — tapi tidak mau bergantung pada server milik salah satu pihak, dan setiap klaim harus bisa ditelusuri ke dokumen sumbernya. AI agent kini bisa memelihara wiki seperti ini — pola LLM Wiki Karpathy — tapi hasilnya terkunci di disk lokal: tidak verifiable, tidak portabel, tidak bisa dikurasi bersama. Cortex memindahkan pola itu ke Walrus dan Sui: setiap halaman adalah blob immutable, setiap klaim punya provenance, dan ketidaksepakatan direkam secara terbuka."

Visual: 1 slide diagram (2 kantor → 1 wiki → Walrus/Sui).

### Scene 1 · 0:40–1:40 — Ingest oleh Agent A

```bash
cortex ingest demo-sources/source1.txt
cortex ingest demo-sources/source2.txt  
cortex ingest demo-sources/source3.txt
```

Tampilkan (split screen terminal + browser):
- Output CLI: raw blob ID → halaman dibuat/di-update → tx digest.
- Sui Explorer: object Wiki, dynamic fields bertambah.
- Walrus Site: halaman muncul, graph view tumbuh (≥5 node).

Narasi kunci: "Konten hidup di Walrus — blob ID-nya deterministik dari konten. Sui hanya menyimpan pointer dan koordinasi. Tidak ada database, tidak ada server kami."

### Scene 2 · 1:40–2:30 — Agent B lint & dispute (keypair berbeda)

```bash
# Agent B lint & dispute
cortex lint
cortex dispute raise \
  --page prosedur-pemulangan-pmi \
  --counter-source demo-sources/counter-pemulangan-jenazah.txt \
  --rationale "Prosedur ini perlu dikemaskini berdasarkan edaran terbaru 2025"
```

Tampilkan:
- Lint report: klaim lemah terdeteksi.
- Explorer: Dispute object — **`raised_by` = alamat B, beda dari pembuat halaman**.
- Site: badge merah di halaman + panel dispute.

Narasi kunci: "Agent B milik pihak lain. Tidak ada server bersama — koordinasinya murni blockchain. Dispute tidak menghapus apa pun; ketidaksepakatan jadi first-class dan permanen."

### Scene 3 · 2:30–3:00 — Query + provenance klik-tembus

```bash
cortex query "Apa syarat penerbitan SPLP untuk PMI yang kehilangan paspor?"
cortex trace syarat-penerbitan-splp "SPLP diterbitkan oleh perwakilan RI"
```

Tampilkan: jawaban bersitasi → trace: klaim → page blob ID → raw blob ID → cuplikan dokumen sumber asli (buka via aggregator URL).

Narasi kunci: "Cortex tidak mengklaim klaim ini *benar* — ia membuktikan klaim ini *berasal dari dokumen ini, versi ini, tidak diubah*. Verifiable provenance, bukan verifiable truth. Persis prinsip Wikipedia, dipindah ke infrastruktur trustless."

### Scene 3.5 · 3:00–3:20 — Ask Cortex (RAG chat)

```bash
cortex chat
> What should I do if I lose my passport abroad?
# Menampilkan jawaban dengan [[slug]] citation tags + Sources block dengan real blob IDs
> How to cook nasi goreng?
# Menampilkan refusal: "That isn't in the Cortex knowledge base yet."
```

Atau tampilkan dari web: klik "ASK" di site nav → ketik pertanyaan paspor → lihat answer bubble + Sources list → klik citation → buka halaman wiki; ketik pertanyaan di luar domain → refusal (no hallucination).

Narasi kunci: "Chat RAG dengan per-claim provenance. Setiap klaim bisa diklik ke sumbernya. Dan lihat — pertanyaan di luar domain ditolak, bukan dihalusinasi."

### Scene 4 · 3:20–4:10 — Time travel

Tampilkan di Walrus Site:
- Buka halaman wiki → panel History menampilkan daftar versi blob + timestamp.
- Pilih dua versi dari dropdown → diff view sisi-sisi (sebelum vs sesudah dispute/update).
- Chain of blob IDs di panel history; tiap versi tetap bisa dibaca (immutable).
- Diff view dibangun dari data on-chain (`history` field di PageRecord + `PageUpdated` events).

### Scene 5 · 4:10–5:00 — Visi (slide penutup)

> "Hari ini: satu wiki, dua agent, satu domain. Tapi primitifnya — provenance wajib, dispute terbuka, history immutable — adalah fondasi second brain kolektif: wiki publik yang dibangun banyak orang dan banyak agent. Wikipedia membuktikan pengetahuan kolektif tidak butuh oracle kebenaran; ia butuh sumber yang bisa ditelusuri dan ketidaksepakatan yang transparan. Cortex membawa mekanisme itu ke agent economy. Ini bukan storage — ini knowledge substrate."

Tutup: logo + GitHub + Site URL + Package ID.

---

## Checklist produksi

**Sebelum rekam (H-2, yaitu 19–20 Juni):**
- [ ] `scripts/demo_e2e.sh` jalan bersih dari clean state 2x berturut-turut
- [ ] Wiki demo final: 5–6 halaman rapi, ≥10 wikilink, lint bersih KECUALI 1 temuan yang disengaja untuk Scene 2
- [ ] Semua blob `--epochs max`; cek `walrus info` sehat; pilih aggregator tercepat
- [ ] Browser bersih: 4 tab (Site Home, Site AskCortex, Explorer, terminal), zoom 125%, font terminal besar
- [ ] Timer terlihat saat latihan; latihan penuh minimal 2x (target 4:30, sisakan margin)

**Saat rekam:**
- [ ] 1080p, 30fps; mic dekat; ruangan senyap
- [ ] Rekam per scene (mudah retake), gabung saat edit
- [ ] Kursor highlight saat klik-tembus provenance (momen paling penting di video)

**Setelah rekam:**
- [ ] Durasi final ≤ 5:00 (hard limit hackathon)
- [ ] Subtitle English (juri global; audio boleh English langsung jika nyaman)
- [ ] Upload YouTube **unlisted/public** (bukan private), tes buka dari incognito
- [ ] Link masuk form DeepSurge + README

---

## Mapping ke judging criteria (pegangan saat editing)

| Scene | Kriteria yang dilayani |
|---|---|
| 0, 3 | Real-World Application (50%) — domain konkret + batasan jujur |
| 1, 2 | Technical Implementation (20%) — Walrus & Sui sebagai inti, bukan tempelan |
| 2, 3, 3.5, 4 | Product & UX (20%) — badge dispute, trace klik-tembus, RAG chat, diff view |
| 5 | Presentation & Vision (10%) |
