"""Tests for the three CWR (Common Works Registration) generators in the
repo: services/cwr_gen.py, utils/cwr_handler.py, services/industry_formatter.py
(dead code, kept for completeness). These exist to give the eventual
consolidation of these three implementations something to check output
against — CWR files feed real PRO (ASCAP/BMI/etc.) registrations, so a
silent behavior change here is a data-correctness bug, not just a style
issue.
"""
from app.services.cwr_gen import CWRGenerator
from app.utils.cwr_handler import generate_cwr_record
from app.services.industry_formatter import IndustryFormatter

SAMPLE_METADATA = {
    "title": "Test Song",
    "artist": "Jane Doe",
    "composer": "Jane Doe",
    "duration": 185,       # 3:05
    "iswc": "T-123456789-0",
    "isrc": "USABC2300001",
    "upc": "123456789012",
}


# ── services/cwr_gen.py — CWRGenerator ──────────────────────────────────────

def test_cwr_gen_produces_all_record_types():
    output = CWRGenerator.generate_cwr(SAMPLE_METADATA)
    lines = output.split("\r\n")
    record_types = [line[:3] for line in lines]

    # Regression test for a real bug: PWR (Publisher-Writer link) was
    # computed but never appended to the output — see cwr_gen.py history.
    assert "PWR" in record_types, "PWR record must be present in CWR output"
    assert record_types == ["HDR", "GRH", "WRK", "SPU", "SPT", "SWR", "PWR", "GRL", "TRL"]


def test_cwr_gen_no_leftover_placeholder_tokens():
    """The Work Type field used to contain the literal debug string
    '_UNK_' instead of a valid (blank) value — assert it's gone."""
    output = CWRGenerator.generate_cwr(SAMPLE_METADATA)
    assert "_UNK_" not in output


def test_cwr_gen_embeds_title_and_duration():
    output = CWRGenerator.generate_cwr(SAMPLE_METADATA)
    wrk_line = next(line for line in output.split("\r\n") if line.startswith("WRK"))
    assert "TEST SONG" in wrk_line
    assert "000305" in wrk_line  # 3 min 5 sec, HHMMSS


def test_cwr_gen_all_lines_have_valid_record_type_prefix():
    output = CWRGenerator.generate_cwr(SAMPLE_METADATA)
    valid_types = {"HDR", "GRH", "WRK", "SPU", "SPT", "SWR", "PWR", "GRL", "TRL"}
    for line in output.split("\r\n"):
        assert line[:3] in valid_types, f"Unexpected record type in line: {line[:20]!r}"


def test_cwr_gen_handles_missing_optional_fields():
    """Should not raise on a minimal input — most real uploads won't have
    composer/iswc filled in."""
    output = CWRGenerator.generate_cwr({"title": "Untitled"})
    assert "UNTITLED" in output
    assert output.startswith("HDR")


# ── utils/cwr_handler.py — generate_cwr_record ──────────────────────────────

def test_cwr_handler_produces_all_record_types():
    output = generate_cwr_record(SAMPLE_METADATA)
    lines = output.split("\n")
    record_types = [line[:3] for line in lines]
    assert record_types == ["HDR", "GRH", "NWR", "SPU", "SWR", "GRT", "TRL"]


def test_cwr_handler_embeds_title_isrc_artist():
    output = generate_cwr_record(SAMPLE_METADATA)
    nwr_line = next(line for line in output.split("\n") if line.startswith("NWR"))
    assert "Test Song" in nwr_line
    assert "USABC2300001" in nwr_line
    swr_line = next(line for line in output.split("\n") if line.startswith("SWR"))
    assert "Jane Doe" in swr_line


def test_cwr_handler_duration_field_is_not_actually_populated():
    """Documents a known limitation: unlike cwr_gen.py, this generator
    hardcodes the duration field to '000000' regardless of input. This
    test exists so a future fix (or the consolidation) changes this
    intentionally rather than by accident."""
    output = generate_cwr_record(SAMPLE_METADATA)
    nwr_line = next(line for line in output.split("\n") if line.startswith("NWR"))
    assert "000000" in nwr_line


# ── services/industry_formatter.py — IndustryFormatter (dead code) ─────────

def test_industry_formatter_rejects_the_standard_field_names():
    """This module is confirmed dead code (nothing imports it). This test
    documents *why* it's safe to assume nothing depends on it: its Jinja2
    template expects `work_title`/`writer_name`, not the `title`/`composer`
    convention every other part of the pipeline (including the other two
    CWR generators) actually uses. Passing it real pipeline output fails."""
    output = IndustryFormatter.generate_cwr_draft(dict(SAMPLE_METADATA))
    assert output.startswith("ERROR_GENERATING_CWR")
    assert "work_title" in output


def test_industry_formatter_renders_with_its_own_expected_keys():
    output = IndustryFormatter.generate_cwr_draft({
        "work_title": "Test Song",
        "writer_name": "Jane Doe",
    })
    assert "NWR" in output
    assert "TEST SONG" in output  # template uppercases the title
    assert not output.startswith("ERROR_GENERATING_CWR")
