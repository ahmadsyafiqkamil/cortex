/// Raw source registry. Sources are immutable external/human documents stored on
/// Walrus; this module records their metadata as dynamic fields on the Wiki, keyed
/// by "src:<blob_id>". Provenance markers in pages point at these raw blobs only —
/// never at other wiki pages (enforced off-chain by the lint agent).
module cortex::source;

use cortex::wiki::{Self, Wiki, ContributorCap};
use std::string::{Self, String};
use sui::clock::Clock;
use sui::dynamic_field as df;
use sui::event;

public struct SourceRecord has store {
    blob: String, // raw source blob ID on Walrus
    title: String,
    origin_url: String, // origin URL ("" allowed for local files)
    added_by: address,
    added_at_ms: u64,
}

public struct SourceRegistered has copy, drop {
    wiki_id: ID,
    blob: String,
    title: String,
    added_by: address,
}

/// Register a raw source on the wiki. Does not validate page citations — that is the
/// lint agent's job (ARCHITECTURE.md §2.2). Idempotent keys are NOT enforced here;
/// callers should check `source_exists` first if needed.
public fun register_source(
    cap: &ContributorCap,
    wiki: &mut Wiki,
    blob: String,
    title: String,
    origin_url: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    wiki::assert_contributor(cap, wiki, ctx);
    let wiki_id = object::id(wiki);
    let added_by = ctx.sender();
    let key = source_key(blob);
    let record = SourceRecord {
        blob,
        title,
        origin_url,
        added_by,
        added_at_ms: clock.timestamp_ms(),
    };
    df::add(wiki::uid_mut(wiki), key, record);
    event::emit(SourceRegistered { wiki_id, blob, title, added_by });
}

/// Lightweight on-chain check used by dispute validation and the lint agent.
public fun source_exists(wiki: &Wiki, blob: String): bool {
    df::exists(wiki::uid(wiki), source_key(blob))
}

/// Canonical dynamic-field key for a source: "src:" + blob id.
fun source_key(blob: String): String {
    let mut key = string::utf8(b"src:");
    key.append(blob);
    key
}
