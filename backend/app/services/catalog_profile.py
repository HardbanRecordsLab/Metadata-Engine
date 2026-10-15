"""Fast catalogue profile: hearing + tempo consensus, no LLM (seconds per track instead of minutes).

Used to bring an already-analysed catalogue up to Engine 3.0: it fixes tempo (quantisation / octave errors), adds the
sonic vector for semantic search and duplicate detection, and proposes a genre correction ONLY when the audio model is
clearly in another genre family than the stored label. ``plan_update`` is pure and unit-tested.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from . import genre_guard, hearing, tempo, trust

CATALOG_MIN_MASS = 0.55          # stricter than a fresh analysis (0.45): do not rewrite stored labels on thin evidence
TEMPO_MIN_AGREEMENT = 0.75       # change a stored BPM only when the estimators agree
TEMPO_MIN_CHANGE = 0.015         # ... and the new value differs by more than 1.5 %


def profile_file(path: str) -> Dict[str, Any]:
    heard = hearing.listen(path)
    t = tempo.estimate_file(path)
    t.pop("beats", None)
    return {"hearing": heard, "tempo": t}


def plan_update(stored: Dict[str, Any], prof: Dict[str, Any]) -> Dict[str, Any]:
    """stored: {'genre','bpm'}; prof: profile_file output. Returns the changes to apply + why (never silent)."""
    out: Dict[str, Any] = {"set": {}, "notes": []}
    h, t = prof.get("hearing"), prof.get("tempo") or {}
    # tempo
    new_bpm, old_bpm = t.get("bpm"), stored.get("bpm")
    if new_bpm and (t.get("agreement") or 0) >= TEMPO_MIN_AGREEMENT:
        ratio = (new_bpm / old_bpm) if old_bpm else None
        if ratio and (abs(ratio - 2.0) < 0.15 or abs(ratio - 0.5) < 0.08):
            # half/double of the stored value: a felt-tempo ambiguity (typical for ambient / cinematic), not an error
            out["notes"].append(f"bpm kept {old_bpm}: engine reads {new_bpm} (octave variant)")
        elif not old_bpm or abs(new_bpm - old_bpm) / max(old_bpm, 1) > TEMPO_MIN_CHANGE:
            out["set"]["bpm"] = int(round(new_bpm))
            out["notes"].append(f"bpm {old_bpm} -> {new_bpm} (agreement {t.get('agreement')})")
    elif new_bpm:
        out["notes"].append(f"bpm kept {old_bpm}: estimators disagree ({t.get('estimates')})")
    # genre
    if h and stored.get("genre"):
        probe = {"mainGenre": stored["genre"], "additionalGenres": []}
        before = probe["mainGenre"]
        genre_guard.apply_hearing_guard(probe, h, min_mass=CATALOG_MIN_MASS)
        if probe["mainGenre"] != before:
            out["set"]["genre"] = probe["mainGenre"]
            out["notes"].append(f"genre {before!r} -> {probe['mainGenre']!r} (audio model: {trust.family_mass(h.get('genre'))})")
    # vocals (informational: stored hasVocals was a constant `true` for the whole catalogue)
    vv = (h or {}).get("vocal_verdict") or {}
    out["hasVocals"] = vv.get("hasVocals")
    out["vocalGender"] = vv.get("gender")
    return out
