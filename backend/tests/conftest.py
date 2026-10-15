"""Test-wide settings.

The CLAP hearing model is ~600 MB and is downloaded on first use: never let a unit test (or CI) trigger that. The hearing helpers
(rank / vector packing / verdicts) and the trust + guard logic are tested without the model; end-to-end listening is verified on
the server with real audio.
"""
import os

os.environ.setdefault("HEARING_ENABLED", "false")
