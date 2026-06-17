from chat.catalog import build_catalog, SYSTEM_SLUGS


class FakeChain:
    def __init__(self, pages):  # pages: dict[slug] -> record
        self._pages = pages

    def list_pages(self):
        return list(self._pages.keys())

    def get_page_record(self, slug):
        return self._pages.get(slug)


class FakeWalrus:
    def __init__(self, blobs):  # blobs: dict[blob_id] -> str
        self._blobs = blobs

    def read(self, blob_id):
        return self._blobs[blob_id].encode("utf-8")


PAGE_MD = (
    "---\ntitle: Lost Passport Abroad\nslug: lost-passport\n---\n\n"
    "Report to the embassy first. ^[blob:RAW1]\n"
)


def test_build_catalog_skips_system_and_deleted():
    chain = FakeChain({
        "_index": {"latest_blob": "B0", "deleted": False},
        "lost-passport": {"latest_blob": "B1", "deleted": False, "sources": []},
        "old-page": {"latest_blob": "B2", "deleted": True, "sources": []},
    })
    walrus = FakeWalrus({"B0": "x", "B1": PAGE_MD, "B2": "y"})

    catalog = build_catalog(chain, walrus)

    slugs = [p.slug for p in catalog]
    assert slugs == ["lost-passport"]
    page = catalog[0]
    assert page.title == "Lost Passport Abroad"
    assert page.page_blob_id == "B1"
    assert "embassy" in page.summary
    assert page.content == PAGE_MD


def test_build_catalog_skips_unreadable_pages():
    chain = FakeChain({"p1": {"latest_blob": "MISSING", "deleted": False, "sources": []}})

    class BrokenWalrus:
        def read(self, blob_id):
            raise RuntimeError("walrus down")

    catalog = build_catalog(chain, BrokenWalrus())
    assert catalog == ()


def test_system_slugs_constant():
    assert "_index" in SYSTEM_SLUGS and "_log" in SYSTEM_SLUGS
