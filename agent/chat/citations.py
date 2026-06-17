"""Layer-3 anti-hallucination: verify per-claim [[slug]] tags and inject blob IDs.

The model tags each claim with [[slug]]. We trust nothing it writes about blob IDs.
This module validates each tag against the pages actually fed, flags fabricated
attributions, and attaches real blob IDs derived from page content.
"""

from __future__ import annotations

import re

from cortex_cli.pageformat import extract_markers, parse_frontmatter, resolve_source_title

from chat.types import Citation, PageRef

_TAG_RE = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")
_UNVERIFIED = "[unverified]"


def verify_citations(answer: str, fed_slugs: set[str]) -> tuple[str, list[str]]:
    """Validate [[slug]] tags in the answer against the pages that were fed.

    Returns (cleaned_answer, used_slugs):
      - tags whose slug was fed are kept; the slug is recorded in used_slugs
        (deduped, in first-seen order)
      - tags whose slug was NOT fed are replaced with "[unverified]"
    """
    used: list[str] = []

    def _replace(match: re.Match) -> str:
        slug = match.group(1).strip()
        if slug in fed_slugs:
            if slug not in used:
                used.append(slug)
            return match.group(0)
        return _UNVERIFIED

    cleaned = _TAG_RE.sub(_replace, answer)
    return cleaned, used


def build_citations(used_slugs: list[str], pages: tuple[PageRef, ...]) -> tuple[Citation, ...]:
    """Build Citations (with real blob IDs) for the pages actually cited.

    Dedups by source_blob_id so a raw source shared by two pages appears once.
    """
    by_slug = {p.slug: p for p in pages}
    citations: list[Citation] = []
    seen: set[str] = set()
    for slug in used_slugs:
        page = by_slug.get(slug)
        if not page:
            continue
        fm = parse_frontmatter(page.content)
        for blob_id in extract_markers(page.content):
            if blob_id in seen:
                continue
            seen.add(blob_id)
            citations.append(
                Citation(
                    slug=slug,
                    page_blob_id=page.page_blob_id,
                    source_blob_id=blob_id,
                    source_title=resolve_source_title(blob_id, fm),
                )
            )
    return tuple(citations)
