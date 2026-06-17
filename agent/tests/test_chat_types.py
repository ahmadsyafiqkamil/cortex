import dataclasses
import pytest
from chat.types import ChatMessage, PageRef, Citation, ChatResponse, ChatError


def test_types_are_frozen():
    msg = ChatMessage(role="user", content="hi")
    with pytest.raises(dataclasses.FrozenInstanceError):
        msg.content = "x"  # type: ignore[misc]


def test_chat_response_defaults():
    resp = ChatResponse(answer="a", citations=(), pages_used=(), refused=False)
    assert resp.refused is False
    assert resp.citations == ()


def test_chat_error_is_runtimeerror():
    assert issubclass(ChatError, RuntimeError)
