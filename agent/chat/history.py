"""Conversation history helpers — formatting for prompts and bounded trimming."""

from __future__ import annotations

from chat.types import ChatMessage

_LABELS = {"user": "User", "assistant": "Assistant"}


def format_history(messages: list[ChatMessage]) -> str:
    return "\n".join(f"{_LABELS.get(m.role, m.role)}: {m.content}" for m in messages)


def trim_history(messages: list[ChatMessage], max_messages: int = 6) -> list[ChatMessage]:
    """Keep only the most recent messages to bound prompt size."""
    if max_messages <= 0:
        return []
    return messages[-max_messages:]
