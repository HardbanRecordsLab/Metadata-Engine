"""Smart cutdowns: 15 / 30 / 60 s edits cut on bar and phrase boundaries with a musical ending.

Sync buyers always ask for cutdowns. Naive trimming (first N seconds) stops mid-phrase on a random beat. This planner
works on the beat grid: it groups beats into bars, finds the phrase structure (4/8-bar blocks counted from where the
track actually starts), and for each target length proposes
  * ``intro`` - from the start of the music, ending on the bar closest to the target with a one-bar fade;
  * ``hook``  - the most energetic phrase-aligned window of that length, which ends where the energy naturally drops.
Pure planning (``plan_cutdowns``) is unit-tested with synthetic grids; ``beat_grid`` and ``render`` use librosa/ffmpeg.
"""
from __future__ import annotations

import subprocess
from typing import Any, Dict, List, Optional, Sequence

import numpy as np


def _bars(beat_times: np.ndarray, beat_energy: np.ndarray, per_bar: int):
    n = (len(beat_times) // per_bar) * per_bar
    starts = beat_times[:n:per_bar]
    energy = beat_energy[:n].reshape(-1, per_bar).mean(axis=1)
    return starts, energy


def plan_cutdowns(beat_times: Sequence[float], beat_energy: Sequence[float], duration: float,
                  targets: Sequence[int] = (15, 30, 60), per_bar: int = 4) -> Dict[str, Any]:
    bt, be = np.asarray(beat_times, dtype=float), np.asarray(beat_energy, dtype=float)
    if bt.size < per_bar * 4 or duration <= 0:
        return {"ok": False, "reason": "not enough beats to plan cutdowns", "cutdowns": []}
    beat_dur = float(np.median(np.diff(bt)))
    bar_dur = beat_dur * per_bar
    starts, energy = _bars(bt, be, per_bar)
    if starts.size < 4:
        return {"ok": False, "reason": "too short", "cutdowns": []}
    # end time of bar i = start of bar i+1; the last bar ends at the end of the audio
    ends = np.append(starts[1:], min(duration, starts[-1] + bar_dur))
    med = float(np.median(energy)) or 1e-9
    body = int(np.argmax(energy > 0.5 * med))                     # first bar with real music
    p75 = float(np.percentile(energy, 90)) or 1e-9          # reference level of the loud sections
    out: List[Dict[str, Any]] = []
    for target in targets:
        n = max(2, int(round(target / bar_dur)))
        if n >= starts.size:
            continue
        # option 1: intro cut
        s0 = body
        e0 = min(starts.size - 1, s0 + n - 1)
        intro = _cut("intro", target, starts, ends, energy, s0, e0, bar_dur, body, p75, duration)
        # option 2: best hook window
        best = None
        for s in range(0, starts.size - n + 1):
            e = s + n - 1
            c = _cut("hook", target, starts, ends, energy, s, e, bar_dur, body, p75, duration)
            if best is None or c["score"] > best["score"]:
                best = c
        out.append({"target": target, "options": [x for x in (intro, best) if x]})
    return {"ok": True, "bar_seconds": round(bar_dur, 3), "bpm": round(60 / beat_dur, 1), "first_music_bar": body, "cutdowns": out}


def _cut(kind: str, target: int, starts, ends, energy, s: int, e: int, bar_dur: float, body: int, p75: float, duration: float) -> Dict[str, Any]:
    start, end = float(starts[s]), float(ends[e])
    dur = end - start
    phrase = ((s - body) % 8 == 0) * 1.0 + (((s - body) % 4 == 0) * 0.5)         # aligned to 8/4-bar phrases
    prev = energy[max(0, s - 2):s]
    if prev.size and energy[s] > 1.2 * prev.mean():                            # the section itself starts here (energy jump)
        phrase = max(phrase, 1.0)
    hook = float(np.clip(energy[s:e + 1].mean() / p75, 0, 1.2))
    drop_at_end = e + 1 < energy.size and energy[e] > 0 and energy[e + 1] < 0.9 * energy[e]
    natural = bool(e >= energy.size - 1 or drop_at_end)
    length_fit = 1.0 - min(1.0, abs(dur - target) / target)
    score = round(0.45 * hook + 0.25 * phrase + 0.2 * length_fit + 0.1 * (1.0 if natural else 0.0), 3)
    fade = 0.0 if (natural and e >= energy.size - 1) else round(min(bar_dur, 3.0), 2)
    return {"kind": kind, "start": round(start, 3), "end": round(end, 3), "duration": round(dur, 3), "bars": e - s + 1,
            "fadeOut": fade, "naturalEnd": natural, "phraseAligned": phrase >= 1.0, "score": score,
            "reason": ("starts where the music starts, ends on a bar line" if kind == "intro"
                       else "most energetic phrase-aligned window" + (", ends where energy drops" if natural else ""))}


def align_beats_to_tempo(beats: Sequence[float], bpm: float) -> np.ndarray:
    """Make the beat grid agree with the consensus tempo: a tracker locked to half-time gets midpoints inserted,
    one locked to double-time keeps every second beat."""
    b = np.asarray(beats, dtype=float)
    if b.size < 4 or not bpm:
        return b
    ratio = float(np.median(np.diff(b))) / (60.0 / bpm)
    if 1.85 <= ratio <= 2.15:                                   # beats are twice as far apart as the tempo says
        mid = (b[:-1] + b[1:]) / 2
        return np.sort(np.concatenate([b, mid]))
    if 0.45 <= ratio <= 0.55:                                   # beats are twice as dense
        return b[::2]
    return b


def regularize_grid(beats: Sequence[float], bpm: float, duration: float,
                    max_resid_s: float = 0.015, max_period_dev: float = 0.01) -> np.ndarray:
    """Replace tracked beat ticks by the straight line they lie on, when the track really has a steady tempo.

    Beat trackers report ticks with jitter and a small bias (a 124 BPM house track came back as 123.2 BPM from the median of
    its ticks), so bar lines computed from them wander by tens of milliseconds - audible as a late cut. For a steady grid
    (electronic music, DAW productions) a straight-line fit through the ticks is the better estimate of where every beat is.
    Returns the original ticks when the fit is not trustworthy (live drift, tempo changes, too few ticks).
    """
    b = np.asarray(beats, dtype=float)
    if b.size < 16 or not bpm or duration <= 0:
        return b
    period = 60.0 / float(bpm)
    # beat index of every tick from the gap to the previous one (a gap of 2 periods = one skipped beat); counting from the
    # first tick instead would mis-number late ticks as soon as the tracker is a fraction of a percent off the tempo
    gaps = np.round(np.diff(b) / period)
    keep = np.append(True, gaps >= 1)                            # one tick per beat, in order
    k = np.concatenate([[0.0], np.cumsum(gaps[gaps >= 1])])
    b = b[keep]
    if b.size < 16:
        return np.asarray(beats, dtype=float)
    slope, intercept = np.polyfit(k, b, 1)
    resid = b - (intercept + slope * k)
    robust = float(np.median(np.abs(resid - np.median(resid))))
    if abs(slope - period) / period > max_period_dev or robust > max_resid_s / 2 or float(np.percentile(np.abs(resid), 90)) > max_resid_s:
        return np.asarray(beats, dtype=float)                    # drifting or erratic: keep what the tracker heard
    n = int(np.floor((duration - intercept) / slope)) + 1       # the grid starts where the tracker found its first beat
    return intercept + slope * np.arange(max(n, 0))


# ───────────────────────────── audio side ─────────────────────────────
def beat_grid(path: str, sr: int = 22050) -> Dict[str, Any]:
    import librosa

    from . import tempo as tempo_mod

    y, _ = librosa.load(path, sr=sr, mono=True)
    duration = y.size / sr
    est = tempo_mod.estimate_file(path)
    beat_times = np.asarray(est.get("beats") or [])
    if beat_times.size >= 16 and est.get("bpm"):
        beat_times = regularize_grid(align_beats_to_tempo(beat_times, est["bpm"]), est["bpm"], duration)
    else:
        _, beats = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr)
    rms = librosa.feature.rms(y=y, hop_length=512)[0]
    frame_t = librosa.frames_to_time(np.arange(rms.size), sr=sr, hop_length=512)
    idx = np.searchsorted(frame_t, np.append(beat_times, duration))
    energy = np.array([rms[idx[i]:max(idx[i] + 1, idx[i + 1])].mean() for i in range(len(beat_times))]) if len(beat_times) else np.array([])
    return {"beat_times": beat_times, "beat_energy": energy, "duration": duration, "tempo": est}


def plan_file(path: str, targets: Sequence[int] = (15, 30, 60)) -> Dict[str, Any]:
    g = beat_grid(path)
    plan = plan_cutdowns(g["beat_times"], g["beat_energy"], g["duration"], targets)
    plan["duration_s"] = round(g["duration"], 2)
    t = g.get("tempo") or {}
    plan["tempo"] = {k: t.get(k) for k in ("bpm", "agreement", "alternatives", "octaveAmbiguous")}
    return plan


def render(path: str, start: float, end: float, fade_out: float, out_path: str, bitrate: str = "320k") -> str:
    dur = end - start
    af = f"afade=t=in:st=0:d=0.02,afade=t=out:st={max(0.0, dur - fade_out):.3f}:d={fade_out:.3f}" if fade_out > 0 else "afade=t=in:st=0:d=0.02"
    codec = ["-c:a", "libmp3lame", "-b:a", bitrate] if out_path.lower().endswith(".mp3") else []
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", path, "-af", af, *codec, out_path],
                   check=True, capture_output=True, timeout=300)
    return out_path
