"""Every record we generate must be accepted by an independent CWR 2.1 grammar (CWR-DataApi). Skipped where that package is not installed."""
import importlib.util
import os
import sys

import pytest

pytest.importorskip("cwr", reason="CWR-API is not installed")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from validate_cwr_with_cwrapi import check_records  # noqa: E402

from test_cwr21 import PUBLISHED, SOLO, SENDER, NOW, SHEET  # noqa: E402,F401
from app.services import cwr21  # noqa: E402


@pytest.mark.parametrize("name,works", [("solo", [SOLO]), ("published", [PUBLISHED]), ("two works", [SOLO, {**SOLO, "submitter_work_number": "HRL00003", "title": "Second"}])])
def test_our_records_are_accepted_by_the_independent_grammar(name, works):
    res = cwr21.build_file(SENDER, works, now=NOW, sender_code="HRL", receiver_code="ZAI")
    accepted, bad = check_records(res.text)
    assert bad == [], f"{name}: {bad}"
    assert accepted == len(res.text.split("\r\n")) - 1


def test_the_old_generators_would_have_been_rejected():
    """The record types and header the previous generators wrote are not CWR: the grammar refuses them (this is why they were replaced)."""
    old = "HDRPB HRL001   HARDBANRECORDS LAB\r\nWRK00000001TEST\r\nGRL00001\r\n"
    _, bad = check_records(old)
    assert any(rt == "WRK" for _, rt, _ in bad) and any(rt == "GRL" for _, rt, _ in bad) and any(rt == "HDR" for _, rt, _ in bad)
