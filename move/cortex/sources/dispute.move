/// Dispute layer. A contributor can flag a page whose content or provenance is
/// questionable. Disputes are purely on-chain records; resolution is handled
/// off-chain by Agent B (lint/dispute keypair) — see ARCHITECTURE.md §2.3.
///
/// Each DisputeRecord is a shared object so both parties can view and update
/// the status without the originator being online.
module cortex::dispute;

use cortex::wiki::{Self, Wiki, ContributorCap};
use std::string::String;
use sui::event;

// === Dispute status constants ===
const STATUS_OPEN: u8 = 0;
const STATUS_RESOLVED: u8 = 1;
const STATUS_REJECTED: u8 = 2;

// === Error codes ===
const E_PAGE_NOT_FOUND: u64 = 0;
const E_DISPUTE_ALREADY_RESOLVED: u64 = 1;

// === Structs ===

/// Shared object representing a single dispute against a specific page version.
public struct DisputeRecord has key {
    id: UID,
    wiki_id: ID,
    page: String,         // canonical slug of the disputed page
    reason_blob: String,  // Walrus blob ID containing the dispute rationale
    raised_by: address,
    status: u8,           // STATUS_OPEN | STATUS_RESOLVED | STATUS_REJECTED
}

// === Events ===

public struct DisputeRaised has copy, drop {
    dispute_id: ID,
    wiki_id: ID,
    page: String,
    reason_blob: String,
    raised_by: address,
}

public struct DisputeResolved has copy, drop {
    dispute_id: ID,
    wiki_id: ID,
    status: u8, // STATUS_RESOLVED or STATUS_REJECTED
    resolved_by: address,
}

// === Entry functions ===

/// Open a dispute against a page. The `reason_blob` must be a Walrus blob ID
/// containing the written rationale. Page must exist; disputes on archived
/// pages are still allowed (to allow post-hoc provenance challenges).
public fun raise_dispute(
    cap: &ContributorCap,
    wiki: &Wiki,
    page: String,
    reason_blob: String,
    ctx: &mut TxContext,
) {
    wiki::assert_contributor(cap, wiki);
    assert!(wiki::page_exists(wiki, page), E_PAGE_NOT_FOUND);

    let wiki_id = object::id(wiki);
    let raised_by = ctx.sender();
    let record = DisputeRecord {
        id: object::new(ctx),
        wiki_id,
        page,
        reason_blob,
        raised_by,
        status: STATUS_OPEN,
    };
    let dispute_id = object::id(&record);
    event::emit(DisputeRaised { dispute_id, wiki_id, page, reason_blob, raised_by });
    transfer::share_object(record);
}

/// Resolve a dispute (mark resolved or rejected). Only a contributor can call this,
/// enforcing that Agent B (the lint/dispute keypair) holds a ContributorCap.
public fun resolve_dispute(
    cap: &ContributorCap,
    wiki: &Wiki,
    dispute: &mut DisputeRecord,
    accept: bool,
    ctx: &mut TxContext,
) {
    wiki::assert_contributor(cap, wiki);
    assert!(dispute.wiki_id == object::id(wiki), 0);
    assert!(dispute.status == STATUS_OPEN, E_DISPUTE_ALREADY_RESOLVED);

    dispute.status = if (accept) { STATUS_RESOLVED } else { STATUS_REJECTED };
    event::emit(DisputeResolved {
        dispute_id: object::id(dispute),
        wiki_id: dispute.wiki_id,
        status: dispute.status,
        resolved_by: ctx.sender(),
    });
}

// === Read-only views ===

public fun dispute_status(d: &DisputeRecord): u8 { d.status }
public fun dispute_page(d: &DisputeRecord): String { d.page }
public fun dispute_raised_by(d: &DisputeRecord): address { d.raised_by }
public fun is_open(d: &DisputeRecord): bool { d.status == STATUS_OPEN }

// === Test-only ===

#[test_only]
public fun status_open(): u8 { STATUS_OPEN }
#[test_only]
public fun status_resolved(): u8 { STATUS_RESOLVED }
#[test_only]
public fun status_rejected(): u8 { STATUS_REJECTED }
