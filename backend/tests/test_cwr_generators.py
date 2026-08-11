"""Tests for the two live CWR (Common Works Registration) generators:
services/cwr_gen.py (used by GET /export/cwr/{job_id}) and
utils/cwr_handler.py (used by POST /cwr/export). A third implementation,
services/industry_formatter.py, was deleted outright: it was confirmed
dead code (no route imported it) and its template expected different
field names (work_title/writer_name) than the rest of the pipeline uses
(title/composer), so it could never have worked against real pipeline
output. CWR files feed real PRO (ASCAP/BMI/etc.) registrations, so a
silent behavior change in the two live generators is a data-correctness
bug, not just a style issue.
"""
from app.services.cwr_gen import CWRGenerator
from app.utils.cwr_handler import generate_cwr_record

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


def test_cwr_handler_duration_field_matches_input():
    """Regression test: this generator used to hardcode the duration field
    to '000000' regardless of input, silently dropping the real duration."""
    output = generate_cwr_record(SAMPLE_METADATA)  # duration=185 -> 3:05
    nwr_line = next(line for line in output.split("\n") if line.startswith("NWR"))
    assert "000305" in nwr_line

