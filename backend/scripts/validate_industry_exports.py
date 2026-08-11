"""Validates CWR and DDEX export output against real, independent
specifications — not just "does it parse as XML" or "is the string present
somewhere in the output" (which is all the unit tests in tests/ check).

This intentionally lives outside the main pytest suite: it depends on
cwr-api (an old, effectively unmaintained package whose bundled
config_cwr dependency calls the legacy `yaml.load(stream)` signature
removed by modern PyYAML — see the monkey-patch below) and on the DDEX
XSD schemas, which must be fetched separately since they aren't
redistributable and DDEX's server blocks the default Python user agent.

Setup (in a scratch/throwaway virtualenv, not the app's runtime env):
    pip install cwr-api xmlschema lxml pyparsing pyyaml

    curl -A "Mozilla/5.0" -o avs_43.xsd \
        http://ddex.net/xml/allowed-value-sets/allowed-value-sets.xsd
    curl -A "Mozilla/5.0" -o release-notification-43.xsd \
        http://ddex.net/xml/ern/43/release-notification.xsd
    curl -A "Mozilla/5.0" -o avs_382.xsd \
        http://ddex.net/xml/avs/avs.xsd
    curl -L -o release-notification-382.xsd \
        https://raw.githubusercontent.com/sshaw/ddex/master/etc/schemas/ern/382/release-notification.xsd

Then set the four DDEX_* paths below and run:
    python scripts/validate_industry_exports.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── DDEX schema file locations — fill in after fetching per the docstring ──
DDEX_ERN_43_XSD = os.environ.get("DDEX_ERN_43_XSD", "")
DDEX_AVS_43_XSD = os.environ.get("DDEX_AVS_43_XSD", "")
DDEX_ERN_382_XSD = os.environ.get("DDEX_ERN_382_XSD", "")
DDEX_AVS_382_XSD = os.environ.get("DDEX_AVS_382_XSD", "")

SAMPLE_METADATA = {
    "title": "Test Song",
    "artist": "Jane Doe",
    "composer": "Jane Doe",
    "duration": 185,
    "iswc": "T-123456789-0",
    "isrc": "USABC2300001",
    "upc": "123456789012",
}


def _patch_legacy_yaml_load():
    import yaml
    _orig_load = yaml.load

    def _patched_load(stream, Loader=None):
        return _orig_load(stream, Loader=yaml.FullLoader)

    yaml.load = _patched_load


def validate_cwr():
    print("=" * 70)
    print("CWR validation (via cwr-api, an independent CWR 2.x parser)")
    print("=" * 70)
    _patch_legacy_yaml_load()

    from app.services.cwr_gen import CWRGenerator
    from app.utils.cwr_handler import generate_cwr_record
    from cwr.parser.decoder.file import default_file_decoder

    decoder = default_file_decoder()
    filename = "CW170001126_000.V21"

    generators = {
        "services/cwr_gen.py (used by GET /export/cwr/{job_id})":
            CWRGenerator.generate_cwr(SAMPLE_METADATA, sender_id="000000123", sender_name="HARBANRECORDS LAB"),
        "utils/cwr_handler.py (used by POST /cwr/export)":
            generate_cwr_record(SAMPLE_METADATA),
    }

    for name, content in generators.items():
        print(f"\n--- {name} ---")
        try:
            decoder.decode({"filename": filename, "contents": content})
            print("PASS: decodes as structurally valid CWR")
        except Exception as e:
            print(f"FAIL: {type(e).__name__}: {e}")


def validate_ddex():
    print()
    print("=" * 70)
    print("DDEX validation (via official DDEX XSD schemas)")
    print("=" * 70)

    if not (DDEX_ERN_43_XSD and DDEX_AVS_43_XSD and DDEX_ERN_382_XSD and DDEX_AVS_382_XSD):
        print("SKIPPED: set DDEX_ERN_43_XSD, DDEX_AVS_43_XSD, DDEX_ERN_382_XSD, "
              "DDEX_AVS_382_XSD env vars to the fetched schema paths (see module docstring).")
        return

    import xmlschema
    from app.utils.ddex_ern import generate_ddex_ern_xml
    from app.services.ddex_orchestrator import DDEXOrchestrator
    from app.services.sonic_intelligence import TrackMetadata

    schema_43 = xmlschema.XMLSchema(
        DDEX_ERN_43_XSD,
        locations={"http://ddex.net/xml/allowed-value-sets": DDEX_AVS_43_XSD},
    )
    schema_382 = xmlschema.XMLSchema(
        DDEX_ERN_382_XSD,
        locations={"http://ddex.net/xml/avs/avs": DDEX_AVS_382_XSD},
    )

    track = TrackMetadata(
        title="Test Song", artist="Jane Doe", isrc="USABC2300001", bpm=120.0, key="C",
        lufs=-14.0, danceability=0.7, mood_vibe="Energetic", energy_level=0.6,
        fingerprint="a" * 64,
    )

    checks = [
        ("utils/ddex_ern.py (used by POST /ddex/export) vs ERN 3.8.2",
         schema_382, generate_ddex_ern_xml(SAMPLE_METADATA)),
        ("services/ddex_orchestrator.py (used by GET /export/ddex/{job_id}) vs ERN 4.3",
         schema_43, DDEXOrchestrator.generate_xml(track)),
    ]

    for name, schema, xml_content in checks:
        print(f"\n--- {name} ---")
        try:
            schema.validate(xml_content)
            print("PASS: valid against the official schema")
        except Exception as e:
            print(f"FAIL: {type(e).__name__}: {str(e).splitlines()[0]}")


if __name__ == "__main__":
    validate_cwr()
    validate_ddex()
