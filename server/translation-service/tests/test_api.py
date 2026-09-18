from dataclasses import dataclass

from fastapi.testclient import TestClient

from app.main import create_app


@dataclass
class Result:
    text: str
    source: str
    target: str
    cached: bool
    elapsed_ms: int
    protected_count: int = 0


class FakeEngine:
    def translate(self, text, source="auto", target="auto", glossary=None, preserve=None):
        return Result(f"translated:{text}", "zh", "en", False, 5, len(preserve or []))

    def health(self):
        return {"model_dir": "fake", "device": "cpu", "compute_type": "int8", "cache_size": 0}


def test_post_translate_compatible_with_extension():
    app = create_app(FakeEngine())
    with TestClient(app) as client:
        response = client.post("/translate", json={"q": "用户支付"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["data"] == "translated:用户支付"
    assert payload["source"] == "zh"
    assert payload["target"] == "en"


def test_get_translate():
    app = create_app(FakeEngine())
    with TestClient(app) as client:
        response = client.get("/translate", params={"q": "hello"})
    assert response.status_code == 200
    assert response.json()["data"] == "translated:hello"
