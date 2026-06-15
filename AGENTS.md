## Learned User Preferences

- After finishing a daily milestone (Hari 4/5/6), user often wants a practical step-by-step guide to try the feature locally, not just a task checklist.
- User frequently requests day work as plan-first-then-implement ("buatkan plan untuk hari ke X; jika sudah oke implement").
- When debugging CLI or terminal errors, user may ask for root-cause diagnosis without changing source code ("tanpa merubah sumber kode").

## Learned Workspace Facts

- Sui CLI 1.73+: list wiki page slugs with `sui client dynamic-field <wiki_object_id>` — object ID is positional, not `--parent-id`.
- Dispute CLI is `python -m cortex_cli dispute` (no `raise` subcommand); `scripts/demo_e2e.sh` may still use stale `dispute raise`.
- `scripts/demo_e2e.sh` does not switch Sui active address; ingest and dispute use whichever wallet `sui client active-address` returns.
- Walrus store error "Could not extract blob_id" usually means insufficient WAL token balance, not a parser bug in `agent/walrus/client.py`.
- Both Agent A and Agent B need testnet SUI and WAL (`sui client faucet`, `walrus get-wal`) before ingest or dispute.
- Demo corpus is `demo-sources/source{1,2,3}.txt` (PMI/WNI consular domain); there is no `list-pages` CLI — slugs come from query output or `sui client dynamic-field`.
