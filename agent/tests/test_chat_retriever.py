from chat.retriever import FullCatalogRetriever
from chat.types import ChatMessage, PageRef

CATALOG = (
    PageRef("lost-passport", "Lost Passport", "Report to embassy.", "md", "B1"),
    PageRef("visa-renewal", "Visa Renewal", "How to renew.", "md", "B2"),
)


class FakeLLM:
    def __init__(self, payload):
        self._payload = payload
        self.last_prompt = None
        self.last_system = None

    def complete_json(self, prompt, system=None, temperature=0.0):
        self.last_prompt = prompt
        self.last_system = system
        return self._payload


def _prompts_dir():
    from pathlib import Path
    return Path(__file__).parent.parent / "llm" / "prompts"


def test_retriever_returns_only_catalog_slugs():
    llm = FakeLLM({"relevant_slugs": ["lost-passport", "ghost-page"]})
    r = FullCatalogRetriever(llm, _prompts_dir())
    out = r.find_relevant("passport lost", [], CATALOG)
    assert out == ["lost-passport"]  # ghost-page filtered out


def test_retriever_empty_on_no_match():
    llm = FakeLLM({"relevant_slugs": []})
    r = FullCatalogRetriever(llm, _prompts_dir())
    assert r.find_relevant("unrelated", [], CATALOG) == []


def test_retriever_passes_history_into_prompt():
    llm = FakeLLM({"relevant_slugs": []})
    r = FullCatalogRetriever(llm, _prompts_dir())
    r.find_relevant("more detail", [ChatMessage("user", "passport?")], CATALOG)
    assert "passport?" in llm.last_prompt
