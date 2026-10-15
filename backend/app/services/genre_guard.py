"""Genre grounding for the LLM classification.

Why this exists: the LLMs never hear the audio, they only get DSP numbers, and the DSP-based genre
hints were broad enough (e.g. "jazz/neo-soul" for ANY tonal track with a high harmonic/percussive
ratio) that 4/4 club tracks were tagged "Cinematic Neo-Soul" and instrumentals got vocals.
Three defences, all deterministic and unit-tested:

1. ``context_genre_hints`` - words in the file name and in the caller-supplied context
   ("Instrumental DJ's Vol. 2", "techno", "club mix") become genre hints with real authority.
2. ``apply_genre_guard`` - after the vote, an organic-genre label (soul/jazz/R&B/blues/folk/classical…)
   is replaced by the matching electronic family when the context or the rhythm says "dance track".
3. ``apply_instrumental`` - an instrumental flag removes vocals from every field the LLM filled.

Nothing here overwrites a label silently: a correction is recorded in ``genreCorrected``.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional

# keyword (lower-case, matched on word starts) -> canonical hint used by the heuristics/prompt
_CONTEXT_KEYWORDS: List[tuple] = [
    (r"drum\s*(?:and|&|n)\s*bass|\bdnb\b|\bd&b\b", "drum and bass"),
    (r"hard\s*style|hardstyle|gabber|hardcore", "hardstyle"),
    (r"dub\s*step|dubstep", "dubstep/bass music"),
    (r"trance|psy(?:chodelic)?\s*trans|trans[- ]?emotion|transhypo|hypotrans|transgenic", "trance/progressive"),
    (r"techno|tekno", "techno"),
    (r"tech\s*house", "tech house/electro house"),
    (r"deep\s*house", "deep house"),
    (r"\bhouse\b", "house"),
    (r"\bedm\b|electro|elektro|digital", "electronic"),
    (r"\bdj\b|club|rave|dance|taniec|disco|party|festival|\bbass\b", "dance/club"),
    (r"remix|\bmix\b", "electronic"),
    (r"ambient|chill\s*out|chillout", "ambient/atmospheric"),
    (r"lo[- ]?fi", "lo-fi/chillhop"),
    (r"hip[- ]?hop|boom\s*bap|\btrap\b", "hip-hop"),
]

# canonical hint -> (family, display base used when a label is rewritten)
_FAMILY_BASE: Dict[str, str] = {
    "drum and bass": "Drum and Bass",
    "hardstyle": "Hardstyle",
    "dubstep/bass music": "Bass Music",
    "trance/progressive": "Trance",
    "techno": "Techno",
    "tech house/electro house": "Tech House",
    "deep house": "Deep House",
    "house": "House",
    "electronic": "Electronic Dance",
    "dance/club": "Club Electronic",
    "melodic techno": "Melodic Techno",
    "hard techno/industrial": "Industrial Techno",
    "electronic/bass music": "Bass Music",
}
_ELECTRONIC_HINTS = set(_FAMILY_BASE)
# priority when several hints match (first wins)
_PRIORITY = ["drum and bass", "hardstyle", "dubstep/bass music", "hard techno/industrial", "melodic techno", "techno",
             "trance/progressive", "tech house/electro house", "deep house", "house", "electronic/bass music",
             "electronic", "dance/club"]

_ORGANIC_TOKENS = re.compile(
    r"\b(neo[- ]?soul|soul|r\s*&\s*b|rnb|r&b|jazz|blues|gospel|folk|country|singer[- ]?songwriter|classical|orchestral|"
    r"bossa|swing|lounge|funk)\b", re.I)
_VOCAL_TERMS = re.compile(r"\b(vocals?|voice|vocalist|singer|singing|choir|chant|rap|rapper|lyric\w*|falsetto|croon\w*)\b", re.I)


def context_genre_hints(file_name: str = "", context: str = "") -> List[str]:
    """Canonical genre hints found in the file name and the caller-supplied context, best first."""
    text = f"{file_name or ''} {context or ''}".lower().replace("_", " ")
    found: List[str] = []
    for pattern, hint in _CONTEXT_KEYWORDS:
        if re.search(pattern, text, re.I) and hint not in found:
            found.append(hint)
    found.sort(key=lambda h: _PRIORITY.index(h) if h in _PRIORITY else 99)
    return found


def is_dance_pulse(features: Dict[str, Any]) -> bool:
    """A steady 4/4-range tempo with real energy. Deliberately simple: the harmonic/percussive ratio is NOT used
    (it reached 20 on club tracks with a quiet kick and made them look 'jazz')."""
    try:
        rhythm = features.get("rhythm", {}) or {}
        energy = features.get("energy", {}) or {}
        tempo = float(rhythm.get("tempo", 0) or 0)
        rms = float(energy.get("rms_mean", 0) or 0)
    except (TypeError, ValueError):
        return False
    # allow half-time detection (60-75 BPM reads of 120-150 BPM tracks); 115 covers deep house / 117 BPM club tracks
    normalized = tempo * 2 if 60 <= tempo < 75 else tempo
    return 115 <= normalized <= 150 and rms >= 0.10


def _best_electronic_hint(hints: Iterable[str]) -> Optional[str]:
    hints = [h for h in hints if h in _ELECTRONIC_HINTS]
    if not hints:
        return None
    return sorted(hints, key=lambda h: _PRIORITY.index(h) if h in _PRIORITY else 99)[0]


def _descriptor(label: str) -> str:
    """One non-organic word from the original label to keep as descriptor ('Cinematic Neo-Soul' -> 'Cinematic')."""
    cleaned = _ORGANIC_TOKENS.sub(" ", label or "")
    skip = {"and", "&", "the", "hip", "hop", "pop", "rock", "metal", "house", "techno", "trance", "dance", "electro", "bass", "club", "punk"}
    words = [w for w in re.split(r"[\s/,-]+", cleaned) if w and w.lower() not in skip]
    return words[0].title() if words else "Melodic"


def apply_genre_guard(result: Dict[str, Any], features: Dict[str, Any], hints: Iterable[str],
                      user_vocal_evidence: bool = False) -> Dict[str, Any]:
    """Replace an organic genre family by the electronic one when context/rhythm clearly says dance track."""
    if not isinstance(result, dict):
        return result
    label = str(result.get("mainGenre") or "")
    if not _ORGANIC_TOKENS.search(label):
        return result
    hints = list(hints or [])
    base = _best_electronic_hint(hints)
    pulse = is_dance_pulse(features)
    # Electronic wins when the context says so, or when the rhythm is a dance pulse and nothing says it is vocal-led.
    if not (base or (pulse and not user_vocal_evidence)):
        return result
    base = base or "dance/club"
    new_label = f"{_descriptor(label)} {_FAMILY_BASE[base]}"
    result["genreCorrected"] = {
        "from": label, "to": new_label,
        "reason": "context/hints" if _best_electronic_hint(hints) else "dance-range tempo and energy",
    }
    result["mainGenre"] = new_label
    extra = [g for g in (result.get("additionalGenres") or []) if not _ORGANIC_TOKENS.search(str(g))]
    for h in hints:
        if h in _FAMILY_BASE and _FAMILY_BASE[h].lower() not in {str(g).lower() for g in extra}:
            extra.append(_FAMILY_BASE[h])
    result["additionalGenres"] = extra[:4]
    kws = [k for k in (result.get("keywords") or []) if not _ORGANIC_TOKENS.search(str(k))]
    result["keywords"] = kws
    try:
        result["confidence"] = round(float(result.get("confidence", 0.8)) * 0.9, 2)
    except (TypeError, ValueError):
        pass
    return result


def apply_instrumental(result: Dict[str, Any]) -> Dict[str, Any]:
    """The caller says the track has no vocals: remove every vocal claim the LLM made."""
    if not isinstance(result, dict):
        return result
    result["hasVocals"] = False
    result["vocalStyle"] = {"gender": "none", "timbre": "none", "delivery": "none", "emotionalTone": "none"}
    result["language"] = "Instrumental"
    for key in ("instrumentation", "keywords", "moods", "useCases"):
        if isinstance(result.get(key), list):
            result[key] = [x for x in result[key] if not _VOCAL_TERMS.search(str(x))]
    if _VOCAL_TERMS.search(str(result.get("mainInstrument") or "")):
        result["mainInstrument"] = "Synth lead"
    return result


def grounding_block(file_name: str, context: str, hints: List[str], instrumental: Optional[bool]) -> str:
    """Text appended to the LLM prompt: authoritative caller context + genre rules."""
    lines = ["", "🧭 GENRE GROUNDING (authoritative - overrides your guess from the DSP numbers):"]
    if context.strip():
        lines.append(f"   • Context from the catalogue owner: {context.strip()[:400]}")
    if file_name:
        lines.append(f"   • File name: {file_name}")
    if hints:
        lines.append(f"   • Genre family implied by context: {', '.join(hints[:3])}")
    if instrumental is True:
        lines.append("   • The track is INSTRUMENTAL: no vocals, no vocal instruments, vocalStyle.gender = none.")
    lines.append("   • mainGenre = '<descriptor> <recognised genre>'. Do NOT choose soul, neo-soul, R&B, jazz, blues, folk or "
                 "classical for a track with a steady 115-150 BPM pulse unless the context says so; a harmonic/percussive ratio "
                 "alone is NOT evidence of jazz or soul.")
    return "\n".join(lines) + "\n"


def apply_hearing_guard(result: Dict[str, Any], hearing: Optional[Dict[str, Any]], min_mass: float = 0.45) -> Dict[str, Any]:
    """The audio model hears a different genre family than the LLM named: what is audible wins.

    Only acts when the hearing model's dominant family holds >= 45% of the probability mass and the LLM label belongs to
    a family that is not compatible with it. The descriptor word of the LLM label is kept ('Cinematic Neo-Soul' ->
    'Cinematic Techno')."""
    from . import trust

    if not isinstance(result, dict) or not hearing:
        return result
    label = str(result.get("mainGenre") or "")
    llm_fam = trust.genre_family(label)
    heard = trust.dominant_family(hearing, min_mass)
    if not heard or not llm_fam or trust.compatible(llm_fam, heard):
        return result
    best = trust.best_label_in_family(hearing, heard)
    if not best:
        return result
    new_label = f"{_descriptor(label)} {best.title()}"
    if result.get("genreCorrected"):                       # keep the first correction's origin
        result["genreCorrected"]["to"] = new_label
        result["genreCorrected"]["reason"] += "+hearing"
    else:
        result["genreCorrected"] = {"from": label, "to": new_label, "reason": "hearing"}
    result["mainGenre"] = new_label
    extra = [g for g in (result.get("additionalGenres") or []) if trust.compatible(trust.genre_family(str(g)), heard)]
    for item in (hearing.get("genre") or [])[:4]:
        if trust.genre_family(item["label"]) == heard and item["label"].title() not in extra and item["label"].title() != best.title():
            extra.append(item["label"].title())
    result["additionalGenres"] = extra[:4]
    return result


_CONTEXT_FAMILIES = {"electronic": {"electronic", "chill"}}


def restrict_hearing_to_context(hearing: Optional[Dict[str, Any]], hints: Iterable[str]) -> Optional[Dict[str, Any]]:
    """The owner told us the family (file name / context says techno, club, DJ set ...): the audio model may rank genres only
    inside it. Otherwise distorted-but-electronic sounds (industrial, hard techno) get read as 'metal' and drag the label away.
    The unrestricted ranking is kept as ``genre_unrestricted``."""
    from . import hearing as hearing_mod
    from . import trust

    if not hearing or not hearing.get("genre_all"):
        return hearing
    base = _best_electronic_hint(hints or [])
    if not base:
        return hearing
    allowed = _CONTEXT_FAMILIES["electronic"]
    kept = [g for g in hearing["genre_all"] if trust.genre_family(g["label"]) in allowed]
    if len(kept) < 3:
        return hearing
    import numpy as np
    labels = [g["label"] for g in kept]
    cos = np.array([g["cos"] for g in kept], dtype=float)
    out = dict(hearing)
    out["genre_unrestricted"] = hearing.get("genre")
    out["genre"] = hearing_mod.rank(labels, cos, float(hearing.get("scale") or 18.0), top=6)
    out["genre_restricted_to"] = sorted(allowed)
    return out
