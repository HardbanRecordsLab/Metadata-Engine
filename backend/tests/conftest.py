"""Test-wide settings.

The CLAP hearing model is ~600 MB and is downloaded on first use: never let a unit test (or CI) trigger that. The hearing helpers
(rank / vector packing / verdicts) and the trust + guard logic are tested without the model; end-to-end listening is verified on
the server with real audio.
"""
import os

os.environ.setdefault("HEARING_ENABLED", "false")


# Dev machines on Windows lack the GTK/Pango libraries weasyprint loads at import time (and may lack `qrcode`), which made every test that
# imports the route package fail at collection. Stub only what cannot be imported; CI (Linux, with the real packages) is unaffected.
import sys  # noqa: E402
from unittest.mock import MagicMock  # noqa: E402

for _name in ("weasyprint", "qrcode"):
    try:
        __import__(_name)
    except Exception:  # noqa: BLE001 - ImportError or OSError from a missing native library
        sys.modules[_name] = MagicMock()
