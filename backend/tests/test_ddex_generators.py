"""Tests for the two DDEX ERN generators: utils/ddex_ern.py (ElementTree,
always escaped) and services/ddex_orchestrator.py (Jinja2 — was previously
unescaped, now runs through an autoescaping Environment). Both are live in
production behind different routes (routes/ddex.py vs routes/export.py), so
this covers the actual XML-injection fix, not just a hypothetical.
"""
import xml.etree.ElementTree as ET

import pytest

from app.utils.ddex_ern import generate_ddex_ern_xml
from app.services.ddex_orchestrator import DDEXOrchestrator
from app.services.sonic_intelligence import TrackMetadata

SAMPLE_METADATA = {
    "title": "Test Song",
    "artist": "Jane Doe",
    "album": "Test Album",
    "isrc": "USABC2300001",
    "upc": "123456789012",
}


def make_track(**overrides) -> TrackMetadata:
    base = dict(
        title="Test Song",
        artist="Jane Doe",
        isrc="USABC2300001",
        bpm=120.0,
        key="C",
        lufs=-14.0,
        danceability=0.7,
        mood_vibe="Energetic",
        energy_level=0.6,
        fingerprint="abc123",
    )
    base.update(overrides)
    return TrackMetadata(**base)


# ── utils/ddex_ern.py ────────────────────────────────────────────────────

def test_ddex_ern_produces_valid_parseable_xml():
    xml_str = generate_ddex_ern_xml(SAMPLE_METADATA)
    root = ET.fromstring(xml_str)  # raises if malformed
    assert root is not None


def test_ddex_ern_embeds_isrc_and_title():
    xml_str = generate_ddex_ern_xml(SAMPLE_METADATA)
    assert "USABC2300001" in xml_str
    assert "Test Song" in xml_str


def test_ddex_ern_escapes_special_characters():
    """ElementTree escapes by construction, but this is the behavior the
    consolidation must preserve — a title with XML special characters
    must not break the document structure."""
    tricky = dict(SAMPLE_METADATA, title='Rock & Roll <feat. "Someone">')
    xml_str = generate_ddex_ern_xml(tricky)

    root = ET.fromstring(xml_str)  # would raise ParseError if unescaped
    assert "<feat." not in xml_str  # raw unescaped tag must not appear
    assert "&amp;" in xml_str or "&#38;" in xml_str


# ── services/ddex_orchestrator.py ───────────────────────────────────────

def test_ddex_orchestrator_produces_valid_parseable_xml():
    xml_str = DDEXOrchestrator.generate_xml(make_track())
    # The template has no XML declaration, so wrap for parsing.
    root = ET.fromstring(xml_str)
    assert root is not None


def test_ddex_orchestrator_embeds_isrc_and_title():
    xml_str = DDEXOrchestrator.generate_xml(make_track())
    assert "USABC2300001" in xml_str
    assert "Test Song" in xml_str


def test_ddex_orchestrator_escapes_special_characters():
    """Regression test for the autoescape fix: this generator used to
    build XML from a bare Jinja2 Template() with no escaping at all, so a
    title containing '&' or '<' would produce malformed/injected XML."""
    track = make_track(title='Rock & Roll <feat. "Someone">')
    xml_str = DDEXOrchestrator.generate_xml(track)

    # Must still be valid, parseable XML — this is what would have failed
    # before autoescape was enabled.
    root = ET.fromstring(xml_str)
    title_text = root.find(".//ReferenceTitle/TitleText")
    assert title_text is not None
    assert title_text.text == 'Rock & Roll <feat. "Someone">'
