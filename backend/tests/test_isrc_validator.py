import pytest

from app.utils.audio_metadata import is_valid_isrc


@pytest.mark.parametrize("isrc", [
    "USABC2300001",
    "US-ABC-23-00001",
    "plaaa2600001",  # lowercase, should still validate (case-insensitive)
    "GBUM71029604",
])
def test_valid_isrc_accepted(isrc):
    assert is_valid_isrc(isrc) is True


@pytest.mark.parametrize("isrc", [
    "",
    "TOO_SHORT",
    "USABC23000012",       # 13 chars, one too many
    "U1ABC2300001",        # 12 chars but country code position has a digit
    "USABCYY00001",        # year must be digits, not letters
    None,
    12345678901,
])
def test_invalid_isrc_rejected(isrc):
    assert is_valid_isrc(isrc) is False
