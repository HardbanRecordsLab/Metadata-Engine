"""Trust layer: per-field evidence, cross-source agreement and review flags.

Every claim in the result (genre, vocals, tempo, energy) is checked against independent sources:
the DSP numbers, the CLAP hearing model, the LLM vote and the caller's context. The output answers
"how much should I believe this, and why?" - and lists contradictions for a human to look at.
Pure functions, no I/O.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional

# genre label -> family. Order matters (first hit wins).
_FAMILIES: List[tuple] = [
    ("electronic", r"techno|house|trance|psytrance|drum and bass|dnb|dubstep|hardstyle|electro|synthwave|edm|breakbeat|"
                   r"electronic|club|bass music|big room|garage|idm|dance(?! pop)"),
    ("chill", r"ambient|chill|downtempo|lo-?fi|drone|new age"),
    ("hiphop", r"hip[- ]?hop|trap|rap|boom bap|drill|phonk"),
    ("pop", r"\bpop\b|dance pop|k-pop|synth-?pop"),
    ("rock", r"rock|metal|punk|grunge|hard core|hardcore"),
    ("organic", r"neo[- ]?soul|soul|r\s*&\s*b|rnb|jazz|blues|gospel|funk|folk|country|acoustic|singer|bossa|swing|lounge"),
    ("orchestral", r"classical|orchestral|cinematic|score|soundtrack|epic"),
    ("world", r"world|latin|reggae|polka|afro|salsa|flamenco|ethnic"),
]
# families that can legitimately co-exist (a "dance pop" track is also electronic, etc.)
_COMPAT = {frozenset(p) for p in [("electronic", "pop"), ("electronic", "chill"), ("electronic", "orchestral"), ("hiphop", "pop"),
                                  ("hiphop", "chill"), ("pop", "organic"), ("rock", "pop"), ("organic", "chill"),
                                  ("orchestral", "chill"), ("world", "organic"), ("world", "electronic"), ("organic", "orchestral")]}


def genre_family(label: str) -> Optional[str]:
    text = (label or "").lower()
    for fam, pat in _FAMILIES:
        if re.search(pat, text):
            return fam
    return None


def compatible(a: Optional[str], b: Optional[str]) -> bool:
    return bool(a and b and (a == b or frozenset((a, b)) in _COMPAT))


def family_mass(ranked: Iterable[Dict[str, Any]]) -> Dict[str, float]:
    """Sum hearing probabilities per genre family."""
    mass: Dict[str, float] = {}
    for item in ranked or []:
        fam = genre_family(item.get("label", ""))
        if fam:
            mass[fam] = mass.get(fam, 0.0) + float(item.get("p", 0.0))
    return {k: round(v, 3) for k, v in sorted(mass.items(), key=lambda kv: -kv[1])}


def dominant_family(hearing: Optional[Dict[str, Any]], min_mass: float = 0.45) -> Optional[str]:
    if not hearing:
        return None
    mass = family_mass(hearing.get("genre"))
    if not mass:
        return None
    fam, m = next(iter(mass.items()))
    return fam if m >= min_mass else None


def best_label_in_family(hearing: Dict[str, Any], family: str) -> Optional[str]:
    for item in hearing.get("genre") or []:
        if genre_family(item.get("label", "")) == family:
            return item["label"]
    return None


# ───────────────────────────── field checks ─────────────────────────────
def _genre_check(result: Dict[str, Any], hearing: Optional[Dict[str, Any]], ctx_hints: List[str]) -> Dict[str, Any]:
    label = str(result.get("mainGenre") or "")
    llm_fam = genre_family(label)
    sources: List[Dict[str, Any]] = [{"source": "llm", "value": label, "family": llm_fam}]
    flags: List[str] = []
    conf = 0.55
    if ctx_hints:
        ctx_fam = genre_family(ctx_hints[0])
        sources.append({"source": "context", "value": ctx_hints[0], "family": ctx_fam})
        conf += 0.15 if compatible(llm_fam, ctx_fam) else -0.25
        if not compatible(llm_fam, ctx_fam):
            flags.append("genre:llm_vs_context")
    if hearing:
        mass = family_mass(hearing.get("genre"))
        agree = sum(m for f, m in mass.items() if compatible(llm_fam, f))
        top = (hearing.get("genre") or [{}])[0]
        sources.append({"source": "hearing", "value": top.get("label"), "family_mass": mass, "agreement": round(agree, 2),
                        "clip_agreement": hearing.get("genre_agreement")})
        conf += (agree - 0.4) * 0.8                      # +0.48 .. -0.32
        conf += 0.05 if (hearing.get("genre_agreement") or 0) >= 0.75 else 0.0
        if agree < 0.25 and mass:
            flags.append("genre:llm_vs_hearing")
    if result.get("genreCorrected"):
        sources.append({"source": "guard", "value": result["genreCorrected"].get("to"), "reason": result["genreCorrected"].get("reason")})
    return {"value": label, "confidence": round(max(0.05, min(0.99, conf)), 2), "sources": sources, "flags": flags}


def _vocal_check(result: Dict[str, Any], hearing: Optional[Dict[str, Any]], dsp_vocal: Optional[bool], instrumental: Optional[bool]) -> Dict[str, Any]:
    votes: Dict[str, Optional[bool]] = {}
    gender = str((result.get("vocalStyle") or {}).get("gender", "")).lower()
    if gender:
        votes["llm"] = False if gender == "none" else True
    if dsp_vocal is not None:
        votes["dsp"] = bool(dsp_vocal)
    if hearing and hearing.get("vocal_verdict", {}).get("hasVocals") is not None:
        votes["hearing"] = hearing["vocal_verdict"]["hasVocals"]
    if instrumental is not None:
        votes["owner"] = not instrumental
    definite = {k: v for k, v in votes.items() if v is not None}
    flags: List[str] = []
    if "owner" in definite:
        value, conf = definite["owner"], 0.95
        disagree = [k for k, v in definite.items() if k != "owner" and v != value]
        if disagree:
            flags.append("vocals:" + "+".join(disagree) + "_vs_owner")
            conf = 0.85
    elif definite:
        yes = sum(1 for v in definite.values() if v)
        value = yes * 2 > len(definite) if yes * 2 != len(definite) else bool(hearing and definite.get("hearing"))
        conf = 0.45 + 0.5 * (max(yes, len(definite) - yes) / len(definite))
        if 0 < yes < len(definite):
            flags.append("vocals:sources_disagree")
            conf -= 0.1
    else:
        value, conf = None, 0.2
    return {"value": value, "confidence": round(max(0.05, min(0.99, conf)), 2),
            "sources": [{"source": k, "value": v} for k, v in votes.items()], "flags": flags}


def _tempo_check(bpm: Optional[float], ctx_hints: List[str], info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not bpm:
        return {"value": None, "confidence": 0.1, "sources": [], "flags": ["tempo:missing"]}
    if info and info.get("bpm"):
        agree = float(info.get("agreement") or 0)
        flags = []
        if agree < 0.6:
            flags.append("tempo:estimators_disagree")
        elif info.get("octaveAmbiguous") and agree < 1.0:
            flags.append("tempo:octave_ambiguous")
        alt = (info.get("alternatives") or [None])[0]
        return {"value": round(float(info["bpm"]), 1), "confidence": round(0.5 + 0.45 * agree - (0.1 if info.get("octaveAmbiguous") else 0), 2),
                "alternative": alt, "sources": [{"source": k, "value": v} for k, v in (info.get("estimates") or {}).items()], "flags": flags}
    flags: List[str] = []
    conf = 0.8
    alt = None
    if bpm < 80 or bpm > 175:
        conf -= 0.3
        alt = round(bpm * 2) if bpm < 80 else round(bpm / 2)
        flags.append("tempo:half_double_ambiguity")
    elif 80 <= bpm < 100 and any(h in ("techno", "house", "trance/progressive", "deep house", "tech house/electro house", "dance/club") for h in ctx_hints):
        conf -= 0.2
        alt = round(bpm * 2) if bpm * 2 <= 150 else None
        flags.append("tempo:slow_for_dance_context")
    return {"value": round(float(bpm), 1), "confidence": round(conf, 2), "alternative": alt, "sources": [{"source": "dsp", "value": round(float(bpm), 1)}], "flags": flags}


def _energy_check(result: Dict[str, Any], rms: Optional[float]) -> Dict[str, Any]:
    level = str(result.get("energyLevel") or result.get("energy_level") or "")
    if rms is None or not level:
        return {"value": level or None, "confidence": 0.3, "sources": [], "flags": []}
    bucket = "Low" if rms < 0.06 else "Medium" if rms < 0.15 else "High"
    order = ["Very Low", "Low", "Medium", "High", "Very High"]
    claimed = next((o for o in order if o.lower() == level.lower()), None)
    flags: List[str] = []
    conf = 0.8
    if claimed:
        dist = abs(order.index(claimed) - order.index(bucket))
        if dist >= 2:
            conf, flags = 0.35, ["energy:llm_vs_dsp"]
        elif dist == 1:
            conf = 0.6
    return {"value": level, "confidence": conf, "sources": [{"source": "llm", "value": level}, {"source": "dsp", "value": bucket, "rms": round(rms, 3)}], "flags": flags}


def build_trust(result: Dict[str, Any], features: Dict[str, Any], hearing: Optional[Dict[str, Any]] = None,
                ctx_hints: Optional[List[str]] = None, instrumental: Optional[bool] = None,
                dsp_vocal: Optional[bool] = None, tempo_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    ctx_hints = ctx_hints or []
    rhythm, energy = (features.get("rhythm") or {}), (features.get("energy") or {})
    bpm = result.get("bpm") or rhythm.get("tempo")
    try:
        bpm = float(bpm) if bpm is not None else None
    except (TypeError, ValueError):
        bpm = None
    try:
        rms = float(energy.get("rms_mean")) if energy.get("rms_mean") is not None else None
    except (TypeError, ValueError):
        rms = None
    fields = {
        "genre": _genre_check(result, hearing, ctx_hints),
        "vocals": _vocal_check(result, hearing, dsp_vocal, instrumental),
        "tempo": _tempo_check(bpm, ctx_hints, tempo_info),
        "energy": _energy_check(result, rms),
    }
    flags = [f for fld in fields.values() for f in fld["flags"]]
    weights = {"genre": 0.4, "vocals": 0.25, "tempo": 0.2, "energy": 0.15}
    score = sum(fields[k]["confidence"] * w for k, w in weights.items())
    return {"score": round(score, 2), "grade": "A" if score >= 0.8 else "B" if score >= 0.65 else "C" if score >= 0.5 else "D",
            "needsReview": bool(flags) or score < 0.6, "flags": flags, "fields": fields,
            "hearingUsed": bool(hearing), "engine": "trust-1"}
