"""Split sheet: the share rules, the signature, the printable HTML/PDF, and the endpoints."""
import copy
from types import SimpleNamespace

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.services import passport, split_sheet as ss

GOOD = {
    "work": {"title": "Midnight Drive", "artist": "CMLP", "isrc": "PL-ABC-26-00001", "iswc": "T-123.456.789-0", "date": "2026-10-30"},
    "contributors": [
        {"name": "Kamil Skomra", "role": "composer_lyricist", "composition_share": 60, "master_share": 70, "ipi": "00123456789", "pro": "ZAiKS"},
        {"name": "Anna Nowak", "role": "composer", "composition_share": 40},
        {"name": "HardbanRecords Lab", "role": "label", "master_share": 30},
    ],
}


@pytest.fixture(autouse=True)
def key():
    passport.use_key_for_tests(Ed25519PrivateKey.generate())
    yield
    passport.use_key_for_tests(None)


def errors_for(**changes):
    d = copy.deepcopy(GOOD)
    for k, v in changes.items():
        if k in d["work"]:
            d["work"][k] = v
        else:
            d[k] = v
    return ss.validate(d)[1]


def test_a_correct_sheet_has_no_problems_and_totals_100_each():
    clean, errs = ss.validate(GOOD)
    assert errs == [] and clean["totals"] == {"composition": 100.0, "master": 100.0}


def test_composition_and_master_pies_are_checked_separately():
    d = copy.deepcopy(GOOD)
    d["contributors"][1]["composition_share"] = 30
    assert any("Composition shares add up to 90" in e for e in ss.validate(d)[1])
    d = copy.deepcopy(GOOD)
    d["contributors"][2]["master_share"] = 20
    assert any("Master (recording) shares add up to 90" in e for e in ss.validate(d)[1])
    d = copy.deepcopy(GOOD)
    for c in d["contributors"]:
        c.pop("master_share", None)
    assert ss.validate(d)[1] == []                                              # a sheet may cover the composition only


def test_thirds_do_not_fail_on_rounding():
    d = {"work": {"title": "T"}, "contributors": [{"name": n, "role": "composer", "composition_share": 33.33} for n in "ABC"]}
    assert any("99.99" in e for e in ss.validate(d)[1])                          # 99.99 is not 100: the writers must split the last 0.01
    d["contributors"][0]["composition_share"] = 33.34
    assert ss.validate(d)[1] == []
    d["contributors"][0]["composition_share"] = "33,34"                          # decimal comma is accepted
    assert ss.validate(d)[1] == []


@pytest.mark.parametrize("change,fragment", [
    ({"title": ""}, "title"), ({"isrc": "BAD"}, "ISRC"), ({"iswc": "123"}, "ISWC"), ({"date": "30.10.2026"}, "date"),
])
def test_work_fields(change, fragment):
    assert any(fragment in e for e in errors_for(**change))


def test_contributor_rules():
    d = copy.deepcopy(GOOD)
    d["contributors"][2]["composition_share"] = 5
    assert any("label" in e and "composition share" in e for e in ss.validate(d)[1])      # a label cannot hold songwriter shares
    d = copy.deepcopy(GOOD)
    d["contributors"][0]["role"] = "wizard"
    assert any("role must be one of" in e for e in ss.validate(d)[1])
    d = copy.deepcopy(GOOD)
    d["contributors"][0]["name"] = ""
    assert any("no name" in e for e in ss.validate(d)[1])
    d = copy.deepcopy(GOOD)
    d["contributors"][0]["composition_share"] = 140
    assert any("between 0 and 100" in e for e in ss.validate(d)[1])
    d = copy.deepcopy(GOOD)
    d["contributors"][0]["composition_share"] = "lots"
    assert any("not a number" in e for e in ss.validate(d)[1])
    d = copy.deepcopy(GOOD)
    d["contributors"][0]["ipi"] = "12"
    assert any("IPI" in e for e in ss.validate(d)[1])
    d = copy.deepcopy(GOOD)
    d["contributors"].append(copy.deepcopy(d["contributors"][1]))
    assert any("listed twice" in e for e in ss.validate(d)[1])
    assert any("at least one" in e for e in ss.validate({"work": {"title": "T"}, "contributors": []})[1])
    many = {"work": {"title": "T"}, "contributors": [{"name": f"N{i}", "role": "composer", "composition_share": 1} for i in range(40)]}
    assert any("At most" in e for e in ss.validate(many)[1])
    producer_only = {"work": {"title": "T"}, "contributors": [{"name": "A", "role": "producer", "master_share": 100}]}
    assert any("Nobody has a composition share" in e for e in ss.validate(producer_only)[1])


def test_signature_round_trip_and_tampering():
    clean, _ = ss.validate(GOOD)
    doc = ss.build_document(clean, prepared_by="user-1")
    ok = ss.verify_document(doc)
    assert ok["valid"] and ok["sharesAddUp"] and ok["problems"] == [] and doc["payload"]["id"] == ok["id"]
    assert doc["payload"]["preparedBy"] and "user-1" not in str(doc)                # only a short hash of the account id is stored
    forged = copy.deepcopy(doc)
    forged["payload"]["contributors"][0]["composition_share"] = 90
    assert ss.verify_document(forged) == {"valid": False, "reason": "signature does not match the document"}
    assert ss.verify_document({"alg": "Ed25519", "payload": {"type": "other"}, "signature": "x"})["valid"] is False
    passport.use_key_for_tests(Ed25519PrivateKey.generate())
    assert ss.verify_document(doc)["valid"] is False                                # signed by a different key


def test_html_escapes_everything_a_user_typed():
    d = copy.deepcopy(GOOD)
    d["work"]["title"] = "<script>alert(1)</script>"
    d["work"]["notes"] = "<img src=x onerror=alert(1)>"
    d["contributors"][0]["name"] = "Kamil <b>S</b>"
    clean, errs = ss.validate(d)
    assert errs == []
    page = ss.render_html(ss.build_document(clean))
    assert "<script>" not in page and "<img" not in page and "<b>S</b>" not in page
    assert "&lt;script&gt;" in page and "Total" in page and page.count('class=line>') == 3          # one signature line per contributor
    assert "100 %" in page


def test_pdf_is_a_pdf_when_weasyprint_is_available():
    from unittest.mock import MagicMock
    import weasyprint
    if isinstance(weasyprint, MagicMock):
        pytest.skip("weasyprint natives not installed on this machine")
    clean, _ = ss.validate(GOOD)
    assert ss.render_pdf(ss.build_document(clean))[:4] == b"%PDF"


# ───────────────────────────── endpoints ─────────────────────────────
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.rate_limit import limiter  # noqa: E402
from app.routes import intelligence as intel  # noqa: E402  (route package first: keeps the import order of production)
from app.dependencies import get_user_and_check_quota  # noqa: E402


@pytest.fixture()
def client():
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(intel.router, prefix="/api")
    app.dependency_overrides[get_user_and_check_quota] = lambda: SimpleNamespace(id="u-split-test")
    return TestClient(app)


def test_endpoint_returns_a_signed_document_or_all_the_problems(client):
    r = client.post("/api/intelligence/splitsheet", json=GOOD)
    assert r.status_code == 200 and r.json()["totals"] == {"composition": 100.0, "master": 100.0}
    doc = r.json()["document"]
    assert client.post("/api/intelligence/splitsheet/verify", json={"document": doc}).json()["valid"] is True
    bad = copy.deepcopy(GOOD)
    bad["work"]["title"] = ""
    bad["contributors"][1]["composition_share"] = 10
    r = client.post("/api/intelligence/splitsheet", json=bad)
    assert r.status_code == 422 and len(r.json()["detail"]["errors"]) >= 2                      # every problem at once, not one per try
    doc["payload"]["contributors"][0]["name"] = "Someone Else"
    assert client.post("/api/intelligence/splitsheet/verify", json={"document": doc}).json()["valid"] is False
    assert client.post("/api/intelligence/splitsheet/verify", json={"nope": 1}).status_code == 400


def test_pdf_endpoints(client, monkeypatch):
    monkeypatch.setattr(ss, "render_pdf", lambda doc: b"%PDF-fake")
    r = client.post("/api/intelligence/splitsheet?format=pdf", json=GOOD)
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf" and r.content == b"%PDF-fake"
    doc = client.post("/api/intelligence/splitsheet", json=GOOD).json()["document"]
    assert client.post("/api/intelligence/splitsheet/pdf", json={"document": doc}).content == b"%PDF-fake"
    doc["payload"]["work"]["title"] = "Tampered"
    assert client.post("/api/intelligence/splitsheet/pdf", json={"document": doc}).status_code == 400
