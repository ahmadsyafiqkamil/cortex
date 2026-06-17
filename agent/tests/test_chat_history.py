from chat.history import format_history, trim_history
from chat.types import ChatMessage


def test_format_history_labels_roles():
    msgs = [ChatMessage("user", "hi"), ChatMessage("assistant", "hello")]
    out = format_history(msgs)
    assert "User: hi" in out
    assert "Assistant: hello" in out


def test_format_history_empty():
    assert format_history([]) == ""


def test_trim_history_keeps_last_n():
    msgs = [ChatMessage("user", str(i)) for i in range(10)]
    trimmed = trim_history(msgs, max_messages=4)
    assert [m.content for m in trimmed] == ["6", "7", "8", "9"]
