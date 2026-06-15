"""Cortex wiki page format parser.

Utilities for parsing the canonical Cortex page format:
  - YAML frontmatter between --- delimiters
  - Provenance markers: ^[blob:<id>]
  - Wikilinks: [[slug]] or [[slug|display text]]

This module is pure (no I/O, no chain/walrus calls) so it is trivially
testable and reusable by query, trace, and lint commands.
"""

from __future__ import annotations

import re
from typing import NamedTuple

# Regex patterns for Cortex-specific markdown syntax.
_MARKER_RE = re.compile(r"\^\[blob:([A-Za-z0-9_\-]+)\]")
_WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")
_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.DOTALL)


class Claim(NamedTuple):
    """A sentence or line that carries at least one provenance marker."""

    text: str
    blobs: list[str]  # blob IDs referenced by this claim


def parse_frontmatter(md: str) -> dict:
    """Parse YAML frontmatter between --- delimiters.

    Returns a dict with keys: title, slug, tags, sources, created.
    Sources is a list of dicts with 'blob' and 'title' keys.
    Returns an empty dict if no frontmatter is found.
    """
    match = _FRONTMATTER_RE.match(md)
    if not match:
        return {}

    try:
        import yaml  # type: ignore[import-untyped]

        data = yaml.safe_load(match.group(1))
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # Fallback: minimal line-by-line parser for simple key: value pairs.
    result: dict = {}
    for line in match.group(1).splitlines():
        if ":" in line and not line.startswith(" ") and not line.startswith("-"):
            key, _, val = line.partition(":")
            result[key.strip()] = val.strip()
    return result


def extract_markers(md: str) -> list[str]:
    """Return all blob IDs referenced by ^[blob:<id>] markers in the text."""
    return _MARKER_RE.findall(md)


def extract_wikilinks(md: str) -> list[str]:
    """Return all slug targets from [[slug]] and [[slug|text]] wikilinks."""
    return _WIKILINK_RE.findall(md)


def body_without_frontmatter(md: str) -> str:
    """Return the markdown body with the frontmatter block stripped."""
    return _FRONTMATTER_RE.sub("", md, count=1).strip()


def split_claims(md: str) -> list[Claim]:
    """Extract lines that carry at least one provenance marker.

    Each returned Claim contains the readable sentence text (markers stripped)
    and the list of blob IDs referenced by its ^[blob:...] markers.
    Lines without markers are skipped.
    """
    body = body_without_frontmatter(md)
    claims: list[Claim] = []

    for line in body.splitlines():
        line = line.strip()
        if not line:
            continue
        blobs = _MARKER_RE.findall(line)
        if blobs:
            # Strip marker syntax for display; keep the text readable.
            clean = _MARKER_RE.sub("", line).strip().rstrip(".")
            if clean:
                claims.append(Claim(text=clean, blobs=blobs))

    return claims


def keyword_score(question: str, slug: str, md: str) -> int:
    """Score a page by keyword overlap with the question.

    Title and slug carry 3x weight; body text carries 1x.
    Returns a non-negative integer — higher means more relevant.
    """
    terms = set(re.findall(r"\w+", question.lower()))
    if not terms:
        return 0

    fm = parse_frontmatter(md)
    title_text = (fm.get("title", "") or "").lower()
    title_terms = set(re.findall(r"\w+", title_text))
    slug_terms = set(re.findall(r"\w+", slug.lower()))
    body = body_without_frontmatter(md).lower()
    body_terms = set(re.findall(r"\w+", body))

    return (
        len(terms & title_terms) * 3
        + len(terms & slug_terms) * 3
        + len(terms & body_terms)
    )


def resolve_source_title(blob_id: str, frontmatter: dict) -> str:
    """Look up the human-readable title for a raw blob ID from frontmatter sources.

    Returns the blob ID itself if no matching entry is found.
    """
    for src in frontmatter.get("sources", []) or []:
        if isinstance(src, dict) and src.get("blob") == blob_id:
            return src.get("title", blob_id)
    return blob_id
