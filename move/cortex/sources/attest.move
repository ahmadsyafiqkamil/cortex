/// Cortex provenance attestation.
///
/// Any address can attest that a wiki page's provenance is verified on-chain.
/// No ContributorCap is required — attestation is open to everyone.
/// Attestations are stored as objects and transferred to the verifier.
module cortex::attest;

use std::string::String;
use sui::event;
use sui::object;
use sui::transfer;

use cortex::wiki::{Self, Wiki};

// === Error codes ===
const E_PAGE_NOT_FOUND: u64 = 0;

// === Structs ===

/// An on-chain record that a specific address verified a page's provenance.
public struct ProvenanceAttestation has key, store {
    id: UID,
    wiki_id: ID,
    page: String,
    page_blob: String,
    verifier: address,
}

// === Events ===

public struct ProvenanceAttested has copy, drop {
    wiki_id: ID,
    page: String,
    page_blob: String,
    verifier: address,
}

// === Entry point ===

/// Attest that the provenance of a wiki page is verified.
/// The attestation object is transferred to the caller (ctx.sender()).
public fun attest_provenance(
    wiki: &Wiki,
    page: String,
    page_blob: String,
    ctx: &mut TxContext,
) {
    assert!(wiki::page_exists(wiki, page), E_PAGE_NOT_FOUND);

    let attestation = ProvenanceAttestation {
        id: object::new(ctx),
        wiki_id: object::id(wiki),
        page,
        page_blob,
        verifier: ctx.sender(),
    };

    event::emit(ProvenanceAttested {
        wiki_id: attestation.wiki_id,
        page: attestation.page,
        page_blob: attestation.page_blob,
        verifier: attestation.verifier,
    });

    transfer::public_transfer(attestation, ctx.sender());
}

// === Read-only views ===

public fun attestation_page(a: &ProvenanceAttestation): String { a.page }

public fun attestation_verifier(a: &ProvenanceAttestation): address { a.verifier }

public fun attestation_blob(a: &ProvenanceAttestation): String { a.page_blob }
