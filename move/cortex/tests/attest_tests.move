#[test_only]
module cortex::attest_tests;

use cortex::attest;
use cortex::wiki::{Self, Wiki, WikiOwnerCap};
use std::string;
use sui::clock;
use sui::test_scenario as ts;
use std::unit_test;

const ADMIN: address = @0xA11CE;

// Test #1 — attest_provenance creates object + transfers to sender for existing page.
#[test]
fun test_attest_success() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    {
        let (mut w, owner) = wiki::new_for_testing(string::utf8(b"Cortex"), &clk, sc.ctx());
        let contrib = wiki::mint_contributor_for_testing(&owner, &w, sc.ctx());
        let page = string::utf8(b"page-a");
        let blob = string::utf8(b"blob_ABC123");

        wiki::add_page(&contrib, &mut w, page, blob, vector[], &clk, sc.ctx());

        attest::attest_provenance(&w, page, blob, sc.ctx());

        unit_test::destroy(w);
        unit_test::destroy(owner);
        unit_test::destroy(contrib);
    };
    clk.destroy_for_testing();
    sc.next_tx(ADMIN);

    let attestation = sc.take_from_sender<attest::ProvenanceAttestation>();
    assert!(attest::attestation_page(&attestation) == string::utf8(b"page-a"), 0);
    assert!(attest::attestation_verifier(&attestation) == ADMIN, 1);
    assert!(attest::attestation_blob(&attestation) == string::utf8(b"blob_ABC123"), 2);

    sc.return_to_sender(attestation);
    sc.end();
}

// Test #2 — attest_provenance aborts for non-existent page.
#[test]
#[expected_failure(abort_code = cortex::attest::E_PAGE_NOT_FOUND)]
fun test_attest_missing_page_aborts() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    {
        let (w, owner) = wiki::new_for_testing(string::utf8(b"Cortex"), &clk, sc.ctx());

        attest::attest_provenance(
            &w,
            string::utf8(b"never-added"),
            string::utf8(b"blob_XYZ"),
            sc.ctx(),
        );

        unit_test::destroy(w);
        unit_test::destroy(owner);
    };
    clk.destroy_for_testing();
    sc.end();
}
