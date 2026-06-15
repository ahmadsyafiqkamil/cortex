"""Unit tests for cortex_cli.pageformat — the pure wiki page parser.

These tests have no I/O and no chain/walrus/LLM dependencies, matching the
module's "pure and trivially testable" design contract.
"""

from __future__ import annotations

import pytest

from cortex_cli import pageformat
from cortex_cli.pageformat import Claim

pytestmark = pytest.mark.unit


PAGE_WITH_FRONTMATTER = """---
title: Consular Protection
slug: consular-protection
tags: [pmi, konsuler]
sources:
  - blob: rawAAA1111111
    title: PMI Handbook
created: 2026-06-15
---

Indonesia provides consular protection abroad ^[blob:rawAAA1111111].
See also [[passport-renewal]] and [[work-permit|Work Permit]].
A line without any marker is not a claim.
"""


# --------------------------------------------------------------------------
# parse_frontmatter
# --------------------------------------------------------------------------

def test_parse_frontmatter_returns_dict_for_valid_yaml():
    # Act
    fm = pageformat.parse_frontmatter(PAGE_WITH_FRONTMATTER)

    # Assert
    assert fm["title"] == "Consular Protection"
    assert fm["slug"] == "consular-protection"
    assert fm["sources"][0]["blob"] == "rawAAA1111111"


def test_parse_frontmatter_returns_empty_dict_when_absent():
    assert pageformat.parse_frontmatter("no frontmatter here") == {}


def test_parse_frontmatter_fallback_parser_handles_simple_pairs(monkeypatch):
    # Force the YAML import to fail so the line-by-line fallback runs.
    import builtins

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "yaml":
            raise ImportError("simulated missing yaml")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    md = "---\ntitle: Hello World\nslug: hello\n---\nbody\n"
    fm = pageformat.parse_frontmatter(md)

    assert fm["title"] == "Hello World"
    assert fm["slug"] == "hello"


# --------------------------------------------------------------------------
# extract_markers
# --------------------------------------------------------------------------

def test_extract_markers_finds_all_blob_ids():
    md = "claim one ^[blob:aaa111] and two ^[blob:bbb-222_x]"
    assert pageformat.extract_markers(md) == ["aaa111", "bbb-222_x"]


def test_extract_markers_returns_empty_when_none():
    assert pageformat.extract_markers("plain text, no markers") == []


# --------------------------------------------------------------------------
# extract_wikilinks
# --------------------------------------------------------------------------

def test_extract_wikilinks_handles_plain_and_aliased():
    md = "see [[passport-renewal]] and [[work-permit|Work Permit]]"
    assert pageformat.extract_wikilinks(md) == ["passport-renewal", "work-permit"]


def test_extract_wikilinks_empty_when_none():
    assert pageformat.extract_wikilinks("no links") == []


# --------------------------------------------------------------------------
# body_without_frontmatter
# --------------------------------------------------------------------------

def test_body_without_frontmatter_strips_only_first_block():
    body = pageformat.body_without_frontmatter(PAGE_WITH_FRONTMATTER)
    assert not body.startswith("---")
    assert "Indonesia provides consular protection" in body
    # A horizontal rule later in the body must survive (only first block stripped).
    md = "---\ntitle: X\n---\nintro\n\n---\n\nmore"
    out = pageformat.body_without_frontmatter(md)
    assert "more" in out
    assert out.count("---") >= 1


# --------------------------------------------------------------------------
# split_claims
# --------------------------------------------------------------------------

def test_split_claims_keeps_only_marked_lines_and_strips_markers():
    claims = pageformat.split_claims(PAGE_WITH_FRONTMATTER)

    # Only the one line carrying a marker counts as a claim.
    assert len(claims) == 1
    claim = claims[0]
    assert isinstance(claim, Claim)
    assert "^[blob:" not in claim.text
    assert claim.text == "Indonesia provides consular protection abroad"
    assert claim.blobs == ["rawAAA1111111"]


def test_split_claims_captures_multiple_blobs_on_one_line():
    md = "X is true ^[blob:aaa111] ^[blob:bbb222]."
    claims = pageformat.split_claims(md)
    assert len(claims) == 1
    assert claims[0].blobs == ["aaa111", "bbb222"]


# --------------------------------------------------------------------------
# keyword_score
# --------------------------------------------------------------------------

def test_keyword_score_weights_title_and_slug_higher_than_body():
    # "consular" appears in title + slug + body -> 3 + 3 + 1 = 7
    score = pageformat.keyword_score(
        "consular", "consular-protection", PAGE_WITH_FRONTMATTER
    )
    assert score == 7


def test_keyword_score_zero_for_empty_question():
    assert pageformat.keyword_score("", "any-slug", PAGE_WITH_FRONTMATTER) == 0


def test_keyword_score_zero_when_no_overlap():
    assert pageformat.keyword_score("xyzzy", "unrelated", "body text") == 0


# --------------------------------------------------------------------------
# resolve_source_title
# --------------------------------------------------------------------------

def test_resolve_source_title_matches_known_blob():
    fm = {"sources": [{"blob": "rawAAA1111111", "title": "PMI Handbook"}]}
    assert pageformat.resolve_source_title("rawAAA1111111", fm) == "PMI Handbook"


def test_resolve_source_title_falls_back_to_blob_id():
    fm = {"sources": [{"blob": "other", "title": "Other"}]}
    assert pageformat.resolve_source_title("unknown-blob", fm) == "unknown-blob"


def test_resolve_source_title_handles_missing_sources_key():
    assert pageformat.resolve_source_title("blobX", {}) == "blobX"
