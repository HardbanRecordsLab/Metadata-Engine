"""Robust tempo: consensus of independent estimators instead of one quantised librosa guess.

Problems with the previous single ``librosa.beat_track`` value (seen on real catalogue tracks):
* quantisation - the tempo is derived from an integer number of ~23 ms frames, so only values like 99.4 / 107.7 / 117.5 /
  123.0 / 136.0 / 143.6 occur (up to +-3 % error); two unrelated tracks both came out at exactly 117.5 BPM;
* octave / triplet confusion (95.7 vs 143.6 BPM for the same track).
This module runs several estimators (Essentia RhythmExtractor2013 multifeature + degara, Percival, refined librosa),
folds them into one pulse class, reports agreement and keeps the alternatives. ``consensus`` is pure and unit-tested.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

logger = logging.getLogger(__name__)

LO, HI = 88.0, 176.0            # canonical range: the usual DJ / sync "felt" tempo window


def refine_from_beats(beat_times: Sequence[float]) -> Optional[float]:
    """Sub-frame BPM from the beat positions: slope of a robust linear fit of time vs beat index."""
    bt = np.asarray(beat_times, dtype=float)
    if bt.size < 8:
        return None
    d = np.diff(bt)
    med = np.median(d)
    keep = np.abs(d - med) < 0.25 * med                      # drop missed / doubled beats
    if keep.sum() < 6:
        return float(60.0 / med)
    idx = np.arange(bt.size)
    # fit on the longest run of well-behaved beats
    ok = np.ones(bt.size, dtype=bool)
    ok[1:] = keep
    ok[:-1] &= keep
    x, y = idx[ok], bt[ok]
    slope = np.polyfit(x, y, 1)[0] if x.size >= 6 else med
    return float(60.0 / slope)


def fold(bpm: float, lo: float = LO, hi: float = HI) -> float:
    """Fold by octaves into [lo, hi)."""
    if bpm <= 0:
        return bpm
    while bpm < lo:
        bpm *= 2
    while bpm >= hi:
        bpm /= 2
    return bpm


def consensus(estimates: Dict[str, Optional[float]], tol: float = 0.02) -> Dict[str, Any]:
    """Cluster octave-folded estimates (within ``tol``) and pick the biggest cluster.

    Returns bpm (mean of the winning cluster, folded), agreement (share of estimators in it), the raw estimates and, when
    the winner could also be read at half/double speed or a second cluster is nearly as strong, ``alternatives``."""
    vals = {k: v for k, v in estimates.items() if v and v > 0}
    if not vals:
        return {"bpm": None, "agreement": 0.0, "estimates": {}, "alternatives": [], "octaveAmbiguous": False}
    folded = {k: fold(v) for k, v in vals.items()}
    names = sorted(folded, key=lambda k: folded[k])
    clusters: List[List[str]] = []
    for n in names:
        if clusters and folded[n] <= np.mean([folded[m] for m in clusters[-1]]) * (1 + tol):
            clusters[-1].append(n)
        else:
            clusters.append([n])
    clusters.sort(key=lambda c: (-len(c), -sum(1 for n in c if n.startswith("essentia"))))
    win = clusters[0]
    bpm = float(np.mean([folded[n] for n in win]))
    alt = [round(float(np.mean([folded[n] for n in c])), 1) for c in clusters[1:] if len(c) >= max(1, len(win) - 1)]
    # an estimator reported the winner in another octave (e.g. 71.8 for 143.6) -> the felt tempo is ambiguous
    ambiguous = bool(alt) or any(abs(vals[n] / folded[n] - 1) > 0.03 for n in win)
    return {"bpm": round(bpm, 1), "agreement": round(len(win) / len(vals), 2), "estimates": {k: round(v, 1) for k, v in vals.items()},
            "alternatives": alt, "octaveAmbiguous": ambiguous}


# ───────────────────────────── estimators ─────────────────────────────
def estimate_file(path: str, seconds: int = 150) -> Dict[str, Any]:
    """Run every available estimator on (at most) the first ``seconds`` of the file. Failures of single estimators are ignored."""
    est: Dict[str, Optional[float]] = {}
    ticks: Optional[np.ndarray] = None
    audio44 = None
    try:
        import essentia.standard as es

        audio44 = es.MonoLoader(filename=path, sampleRate=44100)()[: 44100 * seconds]
        for name, method in (("essentia_multifeature", "multifeature"), ("essentia_degara", "degara")):
            try:
                bpm, t, conf, _, _ = es.RhythmExtractor2013(method=method)(audio44)
                est[name] = float(bpm)
                if method == "multifeature":
                    ticks = np.asarray(t)
                    est["essentia_multifeature_refined"] = refine_from_beats(t)
            except Exception as e:  # noqa: BLE001
                logger.debug("%s failed: %s", name, e)
        try:
            est["percival"] = float(es.PercivalBpmEstimator()(audio44))
        except Exception as e:  # noqa: BLE001
            logger.debug("percival failed: %s", e)
    except Exception as e:  # noqa: BLE001 - essentia is optional
        logger.info("essentia unavailable: %s", e)
    try:
        import librosa

        if audio44 is not None:
            y = librosa.resample(audio44.astype(np.float32), orig_sr=44100, target_sr=22050)
        else:
            y, _ = librosa.load(path, sr=22050, mono=True, duration=seconds)
        _, beats = librosa.beat.beat_track(y=y, sr=22050, start_bpm=125, tightness=100)
        bt = librosa.frames_to_time(beats, sr=22050)
        est["librosa_refined"] = refine_from_beats(bt)
        if ticks is None:
            ticks = bt
    except Exception as e:  # noqa: BLE001
        logger.debug("librosa tempo failed: %s", e)
    # the refined multifeature value is a second look at the same estimator: do not let it double-vote
    primary = {k: v for k, v in est.items() if k != "essentia_multifeature_refined"}
    if est.get("essentia_multifeature_refined"):
        primary["essentia_multifeature"] = est["essentia_multifeature_refined"]
    res = consensus(primary)
    res["beats"] = [round(float(t), 3) for t in (ticks if ticks is not None else [])]
    return res
