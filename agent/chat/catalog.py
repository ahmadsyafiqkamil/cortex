"""Build the page catalog the chat engine retrieves over.

Reads every non-system page once and keeps the full markdown on the PageRef so
the answer step does not re-read Walrus.
"""

from __future__ import annotations

from cortex_cli.pageformat import body_without_frontmatter, parse_frontmatter

from chat.types import PageRef

SYSTEM_SLUGS = frozenset({"_index", "_log"})

_SUMMARY_MAX = 160


def _first_line(md: str) -> str:
    for line in body_without_frontmatter(md).splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            return line[:_SUMMARY_MAX]
    return ""


def build_catalog(chain, walrus) -> tuple[PageRef, ...]:
    """Return PageRefs for all live, readable, non-system pages.

    Unreadable pages are skipped, never raised — a single bad blob must not break
    the whole catalog.
    """
    refs: list[PageRef] = []
    for slug in chain.list_pages():
        if slug in SYSTEM_SLUGS:
            continue
        record = chain.get_page_record(slug)
        if not record or record.get("deleted"):
            continue
        blob_id = record.get("latest_blob", "")
        if not blob_id:
            continue
        try:
            md = walrus.read(blob_id).decode("utf-8", errors="replace")
        except Exception:
            continue
        fm = parse_frontmatter(md)
        refs.append(
            PageRef(
                slug=slug,
                title=fm.get("title", slug) or slug,
                summary=_first_line(md),
                content=md,
                page_blob_id=blob_id,
            )
        )
    return tuple(refs)
