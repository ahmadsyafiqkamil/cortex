# SETUP.md — Cortex Environment (Ubuntu 22.04+ / macOS + Docker)

Target akhir: Sui CLI tersambung testnet dengan **dua alamat ber-SUI**, Walrus CLI bisa store/read, site-builder terpasang, Python env siap, LLM API key aktif, Node + pnpm untuk frontend.

> Alternatif cepat: pakai Docker dev container (`docs/DOCKER.md`) — semua tooling sudah terpasang di image.

> ⚠️ Ekosistem Sui/Walrus bergerak cepat. Jika ada perintah yang gagal, JANGAN tebak-tebak — cek docs resmi: docs.sui.io (Sui) dan docs.wal.app (Walrus/Sites), lalu perbarui dokumen ini.

---

## 1. Prasyarat sistem

```bash
sudo apt update && sudo apt install -y curl git build-essential libssl-dev pkg-config
# Rust (dibutuhkan beberapa tooling)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
# Node 22+ (untuk Eleventy & tooling site)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
# Python 3.11+
python3 --version   # pastikan ≥3.11
```

## 2. suiup (installer resmi tooling Sui/Walrus)

`suiup` adalah cara yang direkomendasikan untuk memasang & mengelola versi `sui`, `walrus`, dan `site-builder`.

```bash
# Ikuti instruksi instalasi suiup di docs resmi (github.com/MystenLabs/suiup)
# Setelah terpasang dan $HOME/.local/bin ada di PATH:
suiup install sui
suiup install walrus
suiup install site-builder
sui --version && walrus --version && site-builder --version
```

Fallback jika suiup bermasalah: binary pre-built per-OS tersedia di release GitHub masing-masing tool (sui, walrus, walrus-sites).

## 3. Konfigurasi Sui testnet + dua alamat

```bash
sui client    # first-run wizard: pilih testnet (fullnode default), buat keypair (ed25519)
sui client active-env            # harus: testnet

# Alamat #1 sudah dibuat wizard = AGENT A. Buat alamat #2 = AGENT B:
sui client new-address ed25519
sui client addresses             # catat keduanya ke agent/.cortex/config.json

# Faucet untuk KEDUA alamat:
sui client switch --address <ADDR_A> && sui client faucet
sui client switch --address <ADDR_B> && sui client faucet
sui client gas                   # verifikasi saldo di masing-masing
```

Jika faucet CLI rate-limited: pakai faucet web/Discord resmi Sui (kanal #testnet-faucet).

## 4. Konfigurasi Walrus (testnet)

```bash
mkdir -p ~/.config/walrus
# Unduh client config resmi (lihat docs.wal.app/docs/getting-started untuk URL config testnet terkini)
# lalu verifikasi koneksi:
walrus info --context testnet
```

`walrus info` harus menampilkan `Epoch duration: 1day` → tanda tersambung ke testnet. Output juga menampilkan harga storage saat ini.

**Token WAL testnet:** operasi store membutuhkan WAL. Dapatkan via `walrus get-wal` (menukar SUI testnet ke WAL) — jika subcommand berbeda di versi Anda, cek `walrus --help`.

Smoke test (Task 1.2):

```bash
echo "cortex smoke test $(date)" > /tmp/smoke.txt
walrus store /tmp/smoke.txt --epochs max --context testnet
# catat blob ID dari output, lalu:
walrus read <BLOB_ID> --context testnet > /tmp/smoke_out.txt
diff /tmp/smoke.txt /tmp/smoke_out.txt && echo OK
```

> ⚠️ **SELALU `--epochs max` di proyek ini.** Epoch testnet hanya 1 hari.

## 5. Konfigurasi site-builder

```bash
mkdir -p ~/.config/walrus
curl https://raw.githubusercontent.com/MystenLabs/walrus-sites/refs/heads/testnet/sites-config.yaml \
  -o ~/.config/walrus/sites-config.yaml
# (Jika nanti deploy mainnet juga: file config harus memuat kedua network — lihat docs sites.)
```

Deploy nanti (Hari 7): `site-builder --context=testnet deploy --epochs max site/dist`

## 6. Python environment

```bash
cd agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## 7. LLM API key (provider-agnostic — OpenAI-compatible)

1. Buat API key di provider pilihan Anda (Google AI Studio untuk Gemini, platform.openai.com untuk GPT, MiniMax, dsb).
2. Salin `agent/.env.example` ke `agent/.env`:
   ```
   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/  # contoh Gemini
   LLM_API_KEY=...
   LLM_MODEL=gemini-2.5-flash
   ```
3. Smoke test: `python -m cortex_cli llm-smoke` — verifikasi konfigurasi berfungsi.

## 8. Frontend (Vite + React)

```bash
# Pastikan Node 22+ dan pnpm terpasang
cd site
pnpm install
pnpm run dev          # dev server (http://localhost:5173)
pnpm run build        # build ke dist/
```

## 9. API server (Chat RAG)

```bash
cd agent
source .venv/bin/activate
python api_server.py   # Flask di http://localhost:5001
# Akses dari frontend: buka AskCortex di site (http://localhost:5173/app/ask)
```

## 10. Konfigurasi proyek

Buat `agent/.cortex/config.json` (template di ARCHITECTURE §4.3). Field `package_id`, `wiki_id`, `contributor_cap` diisi setelah deploy.

## 11. Checklist akhir (gate Hari 1)

- [ ] `sui client active-env` = testnet, dua alamat ber-SUI
- [ ] `walrus info --context testnet` sukses, saldo WAL ada
- [ ] Smoke test store/read identik
- [ ] `site-builder --version` jalan + sites-config.yaml terpasang
- [ ] `python -m cortex_cli --help` jalan di venv
- [ ] `python -m cortex_cli llm-smoke` sukses (provider-agnostic LLM)
- [ ] `cd site && pnpm install && pnpm run build` sukses
- [ ] `python api_server.py` jalan (Chat RAG API)
- [ ] Repo GitHub publik ter-push

## Troubleshooting umum

| Gejala | Kemungkinan | Aksi |
|---|---|---|
| `walrus store` error saldo | Belum punya WAL testnet | `walrus get-wal` / cek docs faucet WAL |
| `Epoch duration` bukan 1day | Config menunjuk mainnet | Periksa `--context` & file config |
| Faucet SUI gagal | Rate limit | Faucet Discord/web; tunggu; pakai alamat lain |
| `sui client publish` gas error | Budget kurang | Naikkan `--gas-budget` (mis. 100000000) |
| Aggregator lambat saat read | Node publik sibuk | Ganti aggregator publik lain (daftar di docs.wal.app) |
