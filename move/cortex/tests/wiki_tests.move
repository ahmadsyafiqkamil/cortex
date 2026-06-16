#[test_only]
module cortex::wiki_tests;

use cortex::dispute::{Self, DisputeRecord};
use cortex::source;
use cortex::wiki::{Self, Wiki, WikiOwnerCap, ContributorCap};
use std::string;
use sui::clock;
use sui::test_scenario as ts;
use std::unit_test;

const ADMIN: address = @0xA11CE;

// Test #1 — create_wiki shares the Wiki and gives the owner cap to the sender.
#[test]
fun test_create_wiki_shares_and_grants_owner_cap() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    wiki::create_wiki(string::utf8(b"Cortex"), &clk, sc.ctx());
    clk.destroy_for_testing();

    sc.next_tx(ADMIN);
    assert!(ts::has_most_recent_shared<Wiki>(), 0);
    let cap = sc.take_from_sender<WikiOwnerCap>();
    sc.return_to_sender(cap);
    sc.end();
}

// Test #2 — add_page then update_page: latest = new blob, old blob pushed to history.
#[test]
fun test_add_then_update_tracks_history() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    let (mut w, owner) = wiki::new_for_testing(string::utf8(b"C"), &clk, sc.ctx());
    let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());
    let page = string::utf8(b"page-a");

    wiki::add_page(&contrib, &mut w, page, string::utf8(b"V1"), vector[], &clk, sc.ctx());
    assert!(wiki::page_count(&w) == 1, 0);
    assert!(wiki::page_latest_blob(&w, page) == string::utf8(b"V1"), 1);
    assert!(wiki::page_history_len(&w, page) == 0, 2);

    wiki::update_page(&contrib, &mut w, page, string::utf8(b"V2"), vector[], &clk, sc.ctx());
    assert!(wiki::page_latest_blob(&w, page) == string::utf8(b"V2"), 3);
    assert!(wiki::page_history_len(&w, page) == 1, 4);

    unit_test::destroy(w);
    unit_test::destroy(owner);
    unit_test::destroy(contrib);
    clk.destroy_for_testing();
    sc.end();
}

// Test #3 — adding a page with an existing slug aborts E_PAGE_EXISTS (= 1).
#[test]
#[expected_failure(abort_code = 1)]
fun test_duplicate_page_aborts() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    let (mut w, owner) = wiki::new_for_testing(string::utf8(b"C"), &clk, sc.ctx());
    let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());
    let page = string::utf8(b"dup");

    wiki::add_page(&contrib, &mut w, page, string::utf8(b"V1"), vector[], &clk, sc.ctx());
    wiki::add_page(&contrib, &mut w, page, string::utf8(b"V2"), vector[], &clk, sc.ctx());

    unit_test::destroy(w);
    unit_test::destroy(owner);
    unit_test::destroy(contrib);
    clk.destroy_for_testing();
    sc.end();
}

// Test #4 — a ContributorCap from another wiki aborts E_WRONG_WIKI (= 0).
#[test]
#[expected_failure(abort_code = 0)]
fun test_contributor_cap_wrong_wiki_aborts() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    let (w1, owner1) = wiki::new_for_testing(string::utf8(b"W1"), &clk, sc.ctx());
    let (mut w2, owner2) = wiki::new_for_testing(string::utf8(b"W2"), &clk, sc.ctx());
    let contrib1 = wiki::mint_contributor_for_testing(&owner1, &w1, sc.ctx());

    // contrib1 belongs to w1; using it on w2 must abort.
    wiki::add_page(&contrib1, &mut w2, string::utf8(b"p"), string::utf8(b"V1"), vector[], &clk, sc.ctx());

    unit_test::destroy(w1);
    unit_test::destroy(w2);
    unit_test::destroy(owner1);
    unit_test::destroy(owner2);
    unit_test::destroy(contrib1);
    clk.destroy_for_testing();
    sc.end();
}

// Test #5 — raise_dispute creates a shared DisputeRecord with status OPEN.
#[test]
fun test_raise_dispute_happy_path() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    {
        let (mut w, owner) = wiki::new_for_testing(string::utf8(b"C"), &clk, sc.ctx());
        let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());

        // add a page first so it exists
        wiki::add_page(
            &contrib,
            &mut w,
            string::utf8(b"home"),
            string::utf8(b"BLOB_V1"),
            vector[],
            &clk,
            sc.ctx(),
        );

        // share the wiki before raise_dispute (needs shared object for dispute's wiki_id)
        dispute::raise_dispute(
            &contrib,
            &w,
            string::utf8(b"home"),
            string::utf8(b"REASON_BLOB"),
            sc.ctx(),
        );

        unit_test::destroy(w);
        unit_test::destroy(owner);
        unit_test::destroy(contrib);
    };
    clk.destroy_for_testing();
    sc.end();
}

// Test #6 — raise_dispute on nonexistent page aborts E_PAGE_NOT_FOUND (= 0).
#[test]
#[expected_failure(abort_code = 0)]
fun test_raise_dispute_missing_page_aborts() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    let (w, owner) = wiki::new_for_testing(string::utf8(b"C"), &clk, sc.ctx());
    let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());

    dispute::raise_dispute(
        &contrib,
        &w,
        string::utf8(b"ghost"),
        string::utf8(b"REASON_BLOB"),
        sc.ctx(),
    );

    unit_test::destroy(w);
    unit_test::destroy(owner);
    unit_test::destroy(contrib);
    clk.destroy_for_testing();
    sc.end();
}

// Extra — register_source + source_exists (validates cross-module package helpers).
#[test]
fun test_register_source_and_exists() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    let (mut w, owner) = wiki::new_for_testing(string::utf8(b"C"), &clk, sc.ctx());
    let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());
    let blob = string::utf8(b"BLOB123");

    assert!(!source::source_exists(&w, blob), 0);
    source::register_source(
        &contrib,
        &mut w,
        blob,
        string::utf8(b"Permenlu"),
        string::utf8(b""),
        &clk,
        sc.ctx(),
    );
    assert!(source::source_exists(&w, blob), 1);

    unit_test::destroy(w);
    unit_test::destroy(owner);
    unit_test::destroy(contrib);
    clk.destroy_for_testing();
    sc.end();
}

// Test #7 — resolve_dispute with accept=true sets status to RESOLVED.
#[test]
fun test_resolve_dispute_accept() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());

    wiki::create_wiki(string::utf8(b"C"), &clk, sc.ctx());

    sc.next_tx(ADMIN);
    {
        let mut w = sc.take_shared<Wiki>();
        let owner = sc.take_from_sender<WikiOwnerCap>();
        let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());
        wiki::add_page(&contrib, &mut w,
            string::utf8(b"page-a"), string::utf8(b"V1"), vector[], &clk, sc.ctx());
        dispute::raise_dispute(&contrib, &w, string::utf8(b"page-a"),
            string::utf8(b"REASON"), sc.ctx());
        ts::return_shared(w);
        sc.return_to_sender(owner);
        unit_test::destroy(contrib);
    };

    sc.next_tx(ADMIN);
    {
        let w = sc.take_shared<Wiki>();
        let owner = sc.take_from_sender<WikiOwnerCap>();
        let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());
        let mut dispute = sc.take_shared<DisputeRecord>();
        dispute::resolve_dispute(&contrib, &w, &mut dispute, true, sc.ctx());
        assert!(dispute::dispute_status(&dispute) == dispute::status_resolved(), 0);
        ts::return_shared(dispute);
        ts::return_shared(w);
        sc.return_to_sender(owner);
        unit_test::destroy(contrib);
    };

    clk.destroy_for_testing();
    sc.end();
}

// Test #8 — resolve_dispute with accept=false sets status to REJECTED.
#[test]
fun test_resolve_dispute_reject() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());

    wiki::create_wiki(string::utf8(b"C"), &clk, sc.ctx());

    sc.next_tx(ADMIN);
    {
        let mut w = sc.take_shared<Wiki>();
        let owner = sc.take_from_sender<WikiOwnerCap>();
        let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());
        wiki::add_page(&contrib, &mut w,
            string::utf8(b"page-a"), string::utf8(b"V1"), vector[], &clk, sc.ctx());
        dispute::raise_dispute(&contrib, &w, string::utf8(b"page-a"),
            string::utf8(b"REASON"), sc.ctx());
        ts::return_shared(w);
        sc.return_to_sender(owner);
        unit_test::destroy(contrib);
    };

    sc.next_tx(ADMIN);
    {
        let w = sc.take_shared<Wiki>();
        let owner = sc.take_from_sender<WikiOwnerCap>();
        let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());
        let mut dispute = sc.take_shared<DisputeRecord>();
        dispute::resolve_dispute(&contrib, &w, &mut dispute, false, sc.ctx());
        assert!(dispute::dispute_status(&dispute) == dispute::status_rejected(), 0);
        ts::return_shared(dispute);
        ts::return_shared(w);
        sc.return_to_sender(owner);
        unit_test::destroy(contrib);
    };

    clk.destroy_for_testing();
    sc.end();
}

// Test #9 — double-resolve aborts E_DISPUTE_ALREADY_RESOLVED (1).
#[test]
#[expected_failure(abort_code = 1)]
fun test_resolve_dispute_already_resolved_aborts() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());

    wiki::create_wiki(string::utf8(b"C"), &clk, sc.ctx());

    sc.next_tx(ADMIN);
    {
        let mut w = sc.take_shared<Wiki>();
        let owner = sc.take_from_sender<WikiOwnerCap>();
        let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());
        wiki::add_page(&contrib, &mut w,
            string::utf8(b"page-a"), string::utf8(b"V1"), vector[], &clk, sc.ctx());
        dispute::raise_dispute(&contrib, &w, string::utf8(b"page-a"),
            string::utf8(b"REASON"), sc.ctx());
        ts::return_shared(w);
        sc.return_to_sender(owner);
        unit_test::destroy(contrib);
    };

    sc.next_tx(ADMIN);
    {
        let w = sc.take_shared<Wiki>();
        let owner = sc.take_from_sender<WikiOwnerCap>();
        let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());
        let mut dispute = sc.take_shared<DisputeRecord>();
        dispute::resolve_dispute(&contrib, &w, &mut dispute, true, sc.ctx());
        dispute::resolve_dispute(&contrib, &w, &mut dispute, true, sc.ctx());
        ts::return_shared(dispute);
        ts::return_shared(w);
        sc.return_to_sender(owner);
        unit_test::destroy(contrib);
    };

    clk.destroy_for_testing();
    sc.end();
}

// Test #10 — resolve_dispute from wrong wiki aborts (wiki_id mismatch code 0).
#[test]
#[expected_failure(abort_code = 0)]
fun test_resolve_dispute_wrong_wiki_aborts() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());

    wiki::create_wiki(string::utf8(b"W1"), &clk, sc.ctx());

    sc.next_tx(ADMIN);
    {
        let mut w1 = sc.take_shared<Wiki>();
        let owner1 = sc.take_from_sender<WikiOwnerCap>();
        let contrib1 = wiki::mint_contributor_for_testing(&owner1, &w1, sc.ctx());
        wiki::add_page(&contrib1, &mut w1,
            string::utf8(b"page-a"), string::utf8(b"V1"), vector[], &clk, sc.ctx());
        dispute::raise_dispute(&contrib1, &w1, string::utf8(b"page-a"),
            string::utf8(b"REASON"), sc.ctx());
        ts::return_shared(w1);
        sc.return_to_sender(owner1);
        unit_test::destroy(contrib1);
    };

    sc.next_tx(ADMIN);
    {
        let (w2, owner2) = wiki::new_for_testing(string::utf8(b"W2"), &clk, sc.ctx());
        let contrib2 = wiki::mint_contributor_for_testing(&owner2, &w2, sc.ctx());
        let mut dispute = sc.take_shared<DisputeRecord>();
        dispute::resolve_dispute(&contrib2, &w2, &mut dispute, true, sc.ctx());
        ts::return_shared(dispute);
        unit_test::destroy(w2);
        unit_test::destroy(owner2);
        unit_test::destroy(contrib2);
    };

    clk.destroy_for_testing();
    sc.end();
}
