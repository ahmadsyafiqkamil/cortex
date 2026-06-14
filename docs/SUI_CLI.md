# Sui CLI — Quick Reference (macOS, Testnet)

Semua perintah ini diasumsikan `sui` sudah di PATH (homebrew sui 1.73+ atau suiup).
Untuk proyek Cortex, selalu gunakan **testnet**.

---

## Cek status saat ini

```bash
# Versi sui yang aktif
sui --version

# Environment aktif (harus: testnet)
sui client active-env

# Alamat aktif saat ini
sui client active-address

# Semua alamat di keystore
sui client addresses

# Saldo SUI di alamat aktif
sui client balance

# Saldo semua coin di alamat aktif (lebih detail)
sui client gas
```

---

## Setup awal (first-run wizard)

Jika belum pernah menjalankan `sui client` sama sekali:

```bash
sui client
# Wizard akan tanya:
#   Sui Full node server URL → tekan Enter (default testnet)
#   alias untuk environment → testnet
#   key scheme → pilih 0 (ed25519)
# Selesai: alamat pertama (Agent A) sudah dibuat.
```

Jika wizard sudah pernah jalan tapi ingin ganti ke testnet:

```bash
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet
sui client active-env   # verifikasi
```

---

## Keypair & alamat

```bash
# Buat alamat baru (Agent B — keypair berbeda dari A)
sui client new-address ed25519

# Lihat semua alamat + alias
sui client addresses

# Ganti alamat aktif
sui client switch --address <ALAMAT>

# Contoh: ganti ke Agent B lalu balik ke Agent A
sui client switch --address 0xBBBB...
sui client switch --address 0xAAAA...
```

> **Aturan keras proyek:** Agent A (ingest/owner) dan Agent B (lint/dispute)
> HARUS keypair berbeda. Jangan gunakan alamat yang sama untuk keduanya.

---

## Faucet testnet (dapatkan SUI gratis)

```bash
# Cara 1: CLI (paling mudah, tapi ada rate limit)
sui client faucet

# Verifikasi saldo setelah faucet (~10-30 detik)
sui client balance
```

Jika CLI rate-limited, pakai alternatif:
- **Web faucet:** https://faucet.testnet.sui.io — masukkan alamat, klik "Request SUI"
- **Discord Sui:** discord.gg/sui → kanal `#testnet-faucet` → kirim `!faucet 0xAlamatKamu`

Faucet memberikan ~1 SUI per request. Publish butuh ~0.1 SUI; sisanya untuk operasi berikutnya.

---

## Build & publish Move package

```bash
# Build dulu — cek apakah ada error kompilasi
cd move/cortex
sui move build --build-env testnet
cd ../..

# Publish (jalankan dari repo root)
sui client publish move/cortex --gas-budget 100000000

# Atau pakai script deploy otomatis proyek ini:
python scripts/deploy_testnet.py
```

> Flag `--build-env testnet` wajib untuk sui >= 1.73 (menghindari error `df::exists unbound`).

---

## Panggil fungsi Move

```bash
# Template umum
sui client call \
  --package <PACKAGE_ID> \
  --module  <NAMA_MODULE> \
  --function <NAMA_FUNGSI> \
  --args <ARG1> <ARG2> \
  --gas-budget 10000000

# Contoh: create_wiki
sui client call \
  --package 0xPKG... \
  --module  wiki \
  --function create_wiki \
  --args "Cortex" 0x6 \
  --gas-budget 10000000

# Contoh: mint_contributor_cap untuk Agent B
sui client call \
  --package 0xPKG... \
  --module  wiki \
  --function mint_contributor_cap \
  --args 0xOWNER_CAP_ID 0xWIKI_ID 0xALAMAT_B \
  --gas-budget 10000000
```

> `0x6` adalah object ID sistem Clock (sama di semua jaringan Sui — tidak perlu diganti).
> `ctx` (TxContext) tidak perlu di-pass — disuplai runtime secara otomatis.

---

## Cek object on-chain

```bash
# Lihat isi object (fields, owner, type)
sui client object <OBJECT_ID>

# Output JSON (lebih mudah di-parse)
sui client object <OBJECT_ID> --json

# Lihat semua object milik alamat aktif
sui client objects

# Lihat semua object milik alamat tertentu
sui client objects --address <ALAMAT>
```

Explorer alternatif (lebih visual):
- https://suiscan.xyz/testnet/object/<OBJECT_ID>
- https://suiexplorer.com/object/<OBJECT_ID>?network=testnet

---

## Cek transaksi

```bash
# Detail transaksi (termasuk objectChanges)
sui client tx-block <TX_DIGEST>
sui client tx-block <TX_DIGEST> --json
```

---

## Alur lengkap task 3.2 (manual tanpa script)

Jika ingin menjalankan step by step tanpa `deploy_testnet.py`:

```bash
# 1. Pastikan testnet & Agent A aktif
sui client active-env      # harus: testnet
sui client active-address  # catat sebagai ADDR_A

# 2. Pastikan ada Agent B
sui client addresses        # cari alamat ke-2, catat sebagai ADDR_B
# Jika belum ada:
sui client new-address ed25519

# 3. Faucet keduanya
sui client switch --address <ADDR_A> && sui client faucet
sui client switch --address <ADDR_B> && sui client faucet
sui client switch --address <ADDR_A>   # balik ke A untuk deploy

# 4. Publish package
sui client publish move/cortex --gas-budget 100000000 --json
# Dari output, cari: objectChanges -> type:"published" -> packageId  = PACKAGE_ID

# 5. create_wiki
sui client call \
  --package <PACKAGE_ID> --module wiki --function create_wiki \
  --args "Cortex" 0x6 --gas-budget 10000000 --json
# Dari output objectChanges:
#   type:"created" + objectType ends "::wiki::Wiki" + owner:"Shared" -> WIKI_ID
#   type:"created" + objectType ends "::wiki::WikiOwnerCap"          -> OWNER_CAP_ID

# 6. Mint ContributorCap untuk Agent A
sui client call \
  --package <PACKAGE_ID> --module wiki --function mint_contributor_cap \
  --args <OWNER_CAP_ID> <WIKI_ID> <ADDR_A> --gas-budget 10000000 --json
# objectChanges -> "::wiki::ContributorCap" owned by ADDR_A -> CAP_A

# 7. Mint ContributorCap untuk Agent B
sui client call \
  --package <PACKAGE_ID> --module wiki --function mint_contributor_cap \
  --args <OWNER_CAP_ID> <WIKI_ID> <ADDR_B> --gas-budget 10000000 --json
# objectChanges -> "::wiki::ContributorCap" owned by ADDR_B -> CAP_B

# 8. Tulis semua ID ke agent/.cortex/config.json
#    (lihat template di agent/config.example.json atau ARCHITECTURE §4.3)
```

---

## Troubleshooting cepat

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| `sui: command not found` | PATH belum include bin sui | `export PATH="/opt/homebrew/bin:$HOME/.local/bin:$PATH"` |
| `sui client` buka wizard ulang | Belum ada `client.yaml` | Ikuti wizard, pilih testnet |
| `active-env` bukan testnet | Environment lain aktif | `sui client switch --env testnet` |
| `InsufficientGas` saat publish | Saldo < 0.1 SUI | `sui client faucet` lalu tunggu 30 detik |
| Faucet: "Too many requests" | Rate-limited | Web faucet / Discord / tunggu 1 jam |
| `df::exists` unbound saat build | sui < 1.73 | `brew upgrade sui` |
| `Error: Object not found` | Object ID salah/typo | `sui client object <ID>` untuk verifikasi |
| `E_WRONG_WIKI (abort 0)` | owner_cap tidak match wiki | Pastikan kedua ID dari transaksi create_wiki yang sama |
