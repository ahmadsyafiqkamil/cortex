/// Cortex wiki: the on-chain coordination layer.
///
/// Walrus holds the content (page blobs); Sui holds only pointers, identity, and
/// coordination. A `Wiki` is a shared object — anyone can READ its state via RPC for
/// free; writing requires a capability. Page versions are never deleted: an update
/// pushes the old blob into `history` and "delete" is a soft flag.
module cortex::wiki;

use std::string::{Self, String};
use sui::clock::Clock;
use sui::dynamic_field as df;
use sui::event;

// === Error codes (see ARCHITECTURE.md §2.1) ===
const E_WRONG_WIKI: u64 = 0;
const E_PAGE_EXISTS: u64 = 1;
const E_PAGE_NOT_FOUND: u64 = 2;
const E_NOT_OWNER: u64 = 3;

// === Structs ===

/// Shared object. PageRecords live as dynamic fields keyed by the canonical slug.
public struct Wiki has key {
    id: UID,
    name: String,
    owner: address,
    page_count: u64,
    created_at_ms: u64,
}

/// Held by the wiki creator. Can mint ContributorCaps and archive pages.
public struct WikiOwnerCap has key, store {
    id: UID,
    wiki_id: ID,
}

/// Grants add/update page + register source + raise dispute rights.
public struct ContributorCap has key, store {
    id: UID,
    wiki_id: ID,
}

/// Per-page state. Stored as a dynamic field on `Wiki.id` (key = canonical slug).
public struct PageRecord has store {
    latest_blob: String, // Walrus blob ID of the current version
    history: vector<String>, // previous blob IDs, oldest -> newest
    sources: vector<String>, // raw source blob IDs cited by the current version
    updated_at_ms: u64,
    updated_by: address,
    deleted: bool, // soft-delete; content is never destroyed
}

// === Events (off-chain graph / time-travel are reconstructed from these) ===

public struct WikiCreated has copy, drop { wiki_id: ID, name: String, owner: address }

public struct PageUpdated has copy, drop {
    wiki_id: ID,
    page: String,
    new_blob: String,
    prev_blob: String, // "" when the page is new
    author: address,
    timestamp_ms: u64,
}

public struct LinkAdded has copy, drop { wiki_id: ID, from_page: String, to_page: String }

// === Entry-style functions ===

/// Share a new Wiki and transfer its owner capability to the sender.
/// The owner cap intentionally goes to the creator, so self_transfer is expected.
#[allow(lint(self_transfer))]
public fun create_wiki(name: String, clock: &Clock, ctx: &mut TxContext) {
    let wiki = Wiki {
        id: object::new(ctx),
        name,
        owner: ctx.sender(),
        page_count: 0,
        created_at_ms: clock.timestamp_ms(),
    };
    let wiki_id = object::id(&wiki);
    event::emit(WikiCreated { wiki_id, name: wiki.name, owner: wiki.owner });
    let cap = WikiOwnerCap { id: object::new(ctx), wiki_id };
    transfer::share_object(wiki);
    transfer::public_transfer(cap, ctx.sender());
}

/// Mint a ContributorCap for `recipient`. Only the matching owner may call this.
public fun mint_contributor_cap(
    cap: &WikiOwnerCap,
    wiki: &Wiki,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert!(cap.wiki_id == object::id(wiki), E_WRONG_WIKI);
    let contributor = ContributorCap { id: object::new(ctx), wiki_id: cap.wiki_id };
    transfer::public_transfer(contributor, recipient);
}

/// Add a new page. Aborts if the slug already exists or the cap is for another wiki.
public fun add_page(
    cap: &ContributorCap,
    wiki: &mut Wiki,
    page: String,
    blob: String,
    sources: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(cap.wiki_id == object::id(wiki), E_WRONG_WIKI);
    assert!(!df::exists(&wiki.id, page), E_PAGE_EXISTS);

    let wiki_id = object::id(wiki);
    let ts = clock.timestamp_ms();
    let author = ctx.sender();
    let record = PageRecord {
        latest_blob: blob,
        history: vector[],
        sources,
        updated_at_ms: ts,
        updated_by: author,
        deleted: false,
    };
    df::add(&mut wiki.id, page, record);
    wiki.page_count = wiki.page_count + 1;
    event::emit(PageUpdated {
        wiki_id,
        page,
        new_blob: blob,
        prev_blob: string::utf8(b""),
        author,
        timestamp_ms: ts,
    });
}

/// Update a page: push the old blob into history, set the new blob as latest.
public fun update_page(
    cap: &ContributorCap,
    wiki: &mut Wiki,
    page: String,
    new_blob: String,
    sources: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(cap.wiki_id == object::id(wiki), E_WRONG_WIKI);
    assert!(df::exists(&wiki.id, page), E_PAGE_NOT_FOUND);

    let wiki_id = object::id(wiki);
    let ts = clock.timestamp_ms();
    let author = ctx.sender();

    let record: &mut PageRecord = df::borrow_mut(&mut wiki.id, page);
    let prev = record.latest_blob;
    record.history.push_back(prev);
    record.latest_blob = new_blob;
    record.sources = sources;
    record.updated_at_ms = ts;
    record.updated_by = author;

    event::emit(PageUpdated {
        wiki_id,
        page,
        new_blob,
        prev_blob: prev,
        author,
        timestamp_ms: ts,
    });
}

/// Soft-delete a page (content stays immutable on Walrus). Owner only.
public fun archive_page(cap: &WikiOwnerCap, wiki: &mut Wiki, page: String) {
    assert!(cap.wiki_id == object::id(wiki), E_NOT_OWNER);
    assert!(df::exists(&wiki.id, page), E_PAGE_NOT_FOUND);
    let record: &mut PageRecord = df::borrow_mut(&mut wiki.id, page);
    record.deleted = true;
}

/// Record a graph edge. Pure event emission — no on-chain graph state is stored.
public fun add_link(cap: &ContributorCap, wiki: &Wiki, from_page: String, to_page: String) {
    assert!(cap.wiki_id == object::id(wiki), E_WRONG_WIKI);
    event::emit(LinkAdded { wiki_id: object::id(wiki), from_page, to_page });
}

// === Package-internal helpers (for cortex::source / cortex::dispute) ===

public(package) fun uid(wiki: &Wiki): &UID { &wiki.id }

public(package) fun uid_mut(wiki: &mut Wiki): &mut UID { &mut wiki.id }

public(package) fun assert_contributor(cap: &ContributorCap, wiki: &Wiki) {
    assert!(cap.wiki_id == object::id(wiki), E_WRONG_WIKI);
}

// === Read-only views (used by tests and off-chain readers) ===

public fun page_count(wiki: &Wiki): u64 { wiki.page_count }

public fun page_exists(wiki: &Wiki, page: String): bool { df::exists(&wiki.id, page) }

public fun page_latest_blob(wiki: &Wiki, page: String): String {
    let record: &PageRecord = df::borrow(&wiki.id, page);
    record.latest_blob
}

public fun page_history_len(wiki: &Wiki, page: String): u64 {
    let record: &PageRecord = df::borrow(&wiki.id, page);
    record.history.length()
}

public fun page_deleted(wiki: &Wiki, page: String): bool {
    let record: &PageRecord = df::borrow(&wiki.id, page);
    record.deleted
}

// === Test-only constructors (return objects directly; no shared-inventory juggling) ===

#[test_only]
public fun new_for_testing(name: String, clock: &Clock, ctx: &mut TxContext): (Wiki, WikiOwnerCap) {
    let wiki = Wiki {
        id: object::new(ctx),
        name,
        owner: ctx.sender(),
        page_count: 0,
        created_at_ms: clock.timestamp_ms(),
    };
    let cap = WikiOwnerCap { id: object::new(ctx), wiki_id: object::id(&wiki) };
    (wiki, cap)
}

#[test_only]
public fun mint_contributor_for_testing(
    cap: &WikiOwnerCap,
    wiki: &Wiki,
    ctx: &mut TxContext,
): ContributorCap {
    assert!(cap.wiki_id == object::id(wiki), E_WRONG_WIKI);
    ContributorCap { id: object::new(ctx), wiki_id: cap.wiki_id }
}
