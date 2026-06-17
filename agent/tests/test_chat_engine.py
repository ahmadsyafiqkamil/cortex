from chat.engine import ChatEngine
from chat.types import ChatMessage, PageRef

PAGE_MD = (
    "---\ntitle: Lost Passport\nslug: lost-passport\n"
    "sources:\n  - blob: RAW1\n    title: Permenlu 5/2018\n---\n\n"
    "Report to the embassy. ^[blob:RAW1]\n"
)


class FakeChain:
    def list_pages(self):
        return ["_index", "lost-passport"]

    def get_page_record(self, slug):
        if slug == "lost-passport":
            return {"latest_blob": "B1", "deleted": False, "sources": []}
        return {"latest_blob": "B0", "deleted": False}


class FakeWalrus:
    def read(self, blob_id):
        return {"B0": "idx", "B1": PAGE_MD}[blob_id].encode()


class FakeRetriever:
    def __init__(self, slugs):
        self._slugs = slugs

    def find_relevant(self, question, history, catalog):
        return list(self._slugs)


class FakeLLM:
    def __init__(self, answer):
        self._answer = answer

    def complete(self, prompt, system=None, temperature=0.2):
        return self._answer


def _prompts_dir():
    from pathlib import Path
    return Path(__file__).parent.parent / "llm" / "prompts"


def _engine(retriever, llm):
    return ChatEngine(
        chain=FakeChain(), walrus=FakeWalrus(), llm=llm,
        retriever=retriever, prompts_dir=_prompts_dir(),
    )


def test_engine_answers_with_verified_citations():
    eng = _engine(FakeRetriever(["lost-passport"]),
                  FakeLLM("Go to the embassy [[lost-passport]]."))
    resp = eng.respond([ChatMessage("user", "I lost my passport")])
    assert resp.refused is False
    assert resp.pages_used == ("lost-passport",)
    assert resp.citations[0].source_blob_id == "RAW1"
    assert "[[lost-passport]]" in resp.answer


def test_engine_refuses_when_no_relevant_page():
    eng = _engine(FakeRetriever([]), FakeLLM("should not be called"))
    resp = eng.respond([ChatMessage("user", "unrelated question")])
    assert resp.refused is True
    assert resp.citations == ()


def test_engine_flags_fabricated_slug():
    eng = _engine(FakeRetriever(["lost-passport"]),
                  FakeLLM("You can sue [[fake-page]]."))
    resp = eng.respond([ChatMessage("user", "options?")])
    assert "[unverified]" in resp.answer
    assert resp.pages_used == ()
