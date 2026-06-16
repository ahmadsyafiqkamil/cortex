/// Contributor application and lifecycle management.
///
/// Any address can submit an application to become a contributor. The wiki owner
/// reviews and approves or rejects. Approved applicants receive a ContributorCap
/// minted by the owner. The owner can also revoke a contributor, which marks them
/// in a revocation list — the existing cap becomes useless but stays at their address.
/// A revoked user may re-apply.
module cortex::contributor;

use cortex::wiki::{Self, Wiki, WikiOwnerCap, ContributorCap};
use std::string::{Self, String};
use sui::address;
use sui::clock::Clock;
use sui::dynamic_field as df;
use sui::event;
use sui::tx_context::TxContext;

const STATUS_PENDING: u8 = 0;
const STATUS_APPROVED: u8 = 1;
const STATUS_REJECTED: u8 = 2;

const E_ALREADY_PENDING: u64 = 0;
const E_APPLICATION_NOT_FOUND: u64 = 1;
const E_ALREADY_RESOLVED: u64 = 2;

public struct ContributorApplication has store {
    applicant: address,
    rationale_blob: String,
    status: u8, // STATUS_PENDING | STATUS_APPROVED | STATUS_REJECTED
    created_at_ms: u64,
    resolved_at_ms: u64,
}

public struct ApplicationSubmitted has copy, drop {
    wiki_id: ID,
    applicant: address,
    rationale_blob: String,
    timestamp_ms: u64,
}

public struct ApplicationResolved has copy, drop {
    wiki_id: ID,
    applicant: address,
    approved: bool,
    timestamp_ms: u64,
}

/// Submit an application. Rationale must be pre-stored on Walrus; caller passes
/// only the blob ID. Aborts if the applicant already has a PENDING application.
/// Previously resolved (approved/rejected) applications do not block re-application.
public fun submit_application(
    wiki: &mut Wiki,
    rationale_blob: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let applicant = ctx.sender();
    let key = application_key(applicant);
    let ts = clock.timestamp_ms();

    if (df::exists(wiki::uid_mut(wiki), key)) {
        let app: &mut ContributorApplication = df::borrow_mut(wiki::uid_mut(wiki), key);
        assert!(app.status != STATUS_PENDING, E_ALREADY_PENDING);
        app.rationale_blob = rationale_blob;
        app.status = STATUS_PENDING;
        app.created_at_ms = ts;
        app.resolved_at_ms = 0;
    } else {
        let app = ContributorApplication {
            applicant,
            rationale_blob,
            status: STATUS_PENDING,
            created_at_ms: ts,
            resolved_at_ms: 0,
        };
        df::add(wiki::uid_mut(wiki), key, app);
    };

    event::emit(ApplicationSubmitted {
        wiki_id: object::id(wiki),
        applicant,
        rationale_blob,
        timestamp_ms: ts,
    });
}

/// Approve a pending application. Owner only. Mints a ContributorCap to the
/// applicant and removes any prior revocation marker.
public fun approve_application(
    cap: &WikiOwnerCap,
    wiki: &mut Wiki,
    applicant: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    wiki::assert_owner(cap, wiki);

    let key = application_key(applicant);
    assert!(df::exists(wiki::uid(wiki), key), E_APPLICATION_NOT_FOUND);

    // Scoped mutable borrow — must release before calling other functions on wiki.
    let resolved_at;
    {
        let app: &mut ContributorApplication = df::borrow_mut(wiki::uid_mut(wiki), key);
        assert!(app.status == STATUS_PENDING, E_ALREADY_RESOLVED);
        app.status = STATUS_APPROVED;
        app.resolved_at_ms = clock.timestamp_ms();
        resolved_at = app.resolved_at_ms;
    };

    if (wiki::is_contributor_revoked(wiki, applicant)) {
        wiki::unrevoke_contributor(cap, wiki, applicant);
    };

    wiki::mint_contributor_cap(cap, wiki, applicant, ctx);

    event::emit(ApplicationResolved {
        wiki_id: object::id(wiki),
        applicant,
        approved: true,
        timestamp_ms: resolved_at,
    });
}

/// Reject a pending application. Owner only.
public fun reject_application(
    cap: &WikiOwnerCap,
    wiki: &mut Wiki,
    applicant: address,
    clock: &Clock,
) {
    wiki::assert_owner(cap, wiki);

    let key = application_key(applicant);
    assert!(df::exists(wiki::uid(wiki), key), E_APPLICATION_NOT_FOUND);

    let resolved_at;
    {
        let app: &mut ContributorApplication = df::borrow_mut(wiki::uid_mut(wiki), key);
        assert!(app.status == STATUS_PENDING, E_ALREADY_RESOLVED);
        app.status = STATUS_REJECTED;
        app.resolved_at_ms = clock.timestamp_ms();
        resolved_at = app.resolved_at_ms;
    };

    event::emit(ApplicationResolved {
        wiki_id: object::id(wiki),
        applicant,
        approved: false,
        timestamp_ms: resolved_at,
    });
}

// === Read-only views ===

public fun application_status(wiki: &Wiki, applicant: address): (u8, String) {
    let key = application_key(applicant);
    let app: &ContributorApplication = df::borrow(wiki::uid(wiki), key);
    (app.status, app.rationale_blob)
}

public fun application_exists(wiki: &Wiki, applicant: address): bool {
    df::exists(wiki::uid(wiki), application_key(applicant))
}

// === Helpers ===

fun application_key(applicant: address): String {
    let mut key = string::utf8(b"app:");
    key.append(address::to_string(applicant));
    key
}

// === Test-only ===

#[test_only]
public fun status_pending(): u8 { STATUS_PENDING }
#[test_only]
public fun status_approved(): u8 { STATUS_APPROVED }
#[test_only]
public fun status_rejected(): u8 { STATUS_REJECTED }

#[test_only]
public fun error_already_pending(): u64 { E_ALREADY_PENDING }
#[test_only]
public fun error_application_not_found(): u64 { E_APPLICATION_NOT_FOUND }
#[test_only]
public fun error_already_resolved(): u64 { E_ALREADY_RESOLVED }
