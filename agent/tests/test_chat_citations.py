from chat.citations import verify_citations, build_citations
from chat.types import PageRef

PAGE_MD = (
    "---\ntitle: Lost Passport\nslug: lost-passport\n"
    "sources:\n  - blob: RAW1\n    title: Permenlu 5/2018\n---\n\n"
    "Report to the embassy. ^[blob:RAW1]\n"
)
PAGE = PageRef(
    slug="lost-passport", title="Lost Passport", summary="Report to the embassy.",
    content=PAGE_MD, page_blob_id="PAGEBLOB1",
)


def test_verify_keeps_valid_tags_and_collects_used_slugs():
    answer = "Go to the embassy [[lost-passport]]."
    cleaned, used = verify_citations(answer, {"lost-passport"})
    assert "[[lost-passport]]" in cleaned
    assert used == ["lost-passport"]


def test_verify_flags_unfed_slug():
    answer = "You can sue them [[made-up-page]]."
    cleaned, used = verify_citations(answer, {"lost-passport"})
    assert "[[made-up-page]]" not in cleaned
    assert "[unverified]" in cleaned
    assert used == []


def test_verify_dedups_used_slugs_in_order():
    answer = "A [[lost-passport]]. B [[lost-passport]]."
    _, used = verify_citations(answer, {"lost-passport"})
    assert used == ["lost-passport"]


def test_build_citations_injects_real_blob_ids():
    cites = build_citations(["lost-passport"], (PAGE,))
    assert len(cites) == 1
    c = cites[0]
    assert c.slug == "lost-passport"
    assert c.page_blob_id == "PAGEBLOB1"
    assert c.source_blob_id == "RAW1"
    assert c.source_title == "Permenlu 5/2018"


def test_build_citations_ignores_unused_slugs():
    cites = build_citations([], (PAGE,))
    assert cites == ()
