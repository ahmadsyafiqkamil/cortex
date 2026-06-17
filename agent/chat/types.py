"""Frozen data contracts for the Cortex chat engine."""

from __future__ import annotations

from dataclasses import dataclass


class ChatError(RuntimeError):
    """Raised on infrastructure failures (chain/LLM config) the caller must surface."""


@dataclass(frozen=True)
class ChatMessage:
    role: str          # "user" | "assistant"
    content: str


@dataclass(frozen=True)
class PageRef:
    slug: str
    title: str
    summary: str       # one-line summary for the selection catalog
    content: str       # full page markdown (reused for the answer step)
    page_blob_id: str  # PageRecord.latest_blob


@dataclass(frozen=True)
class Citation:
    slug: str
    page_blob_id: str
    source_blob_id: str   # raw source blob — the real provenance anchor
    source_title: str


@dataclass(frozen=True)
class ChatResponse:
    answer: str
    citations: tuple[Citation, ...]
    pages_used: tuple[str, ...]
    refused: bool
