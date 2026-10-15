"""Technical QC + sync-readiness.

Everything a music supervisor / distributor checks before accepting a file, computed from the audio itself:
EBU R128 loudness and true peak (ffmpeg ebur128), clipping, silence at head/tail and an abrupt ending,
and the *lossy-origin* test - a WAV/FLAC whose spectrum is brick-walled at 16-20 kHz was almost certainly decoded
from an MP3/AAC and is not a master (this catalogue has hundreds of those).
Pure functions are unit-tested; ``analyze_file`` shells out to ffmpeg/ffprobe.
"""
from __future__ import annotations

import json
import re
import subprocess
from typing import Any, Dict, List, Optional

import numpy as np

SR = 44100


# ───────────────────────────── pure parsers / maths ─────────────────────────────
def parse_ebur128(stderr: str) -> Dict[str, Optional[float]]:
    """Parse the Summary block printed by ffmpeg's ebur128 filter."""
    tail = stderr[stderr.rfind("Summary:"):] if "Summary:" in stderr else stderr

    def grab(pattern: str) -> Optional[float]:
        m = re.search(pattern, tail)
        return float(m.group(1)) if m else None

    return {"integrated_lufs": grab(r"\bI:\s+(-?[\d.]+)\s+LUFS"), "lra": grab(r"\bLRA:\s+(-?[\d.]+)\s+LU\b"),
            "true_peak_dbtp": grab(r"True peak:\s*\n?\s*Peak:\s+(-?[\d.]+)\s+dBFS") or grab(r"\bPeak:\s+(-?[\d.]+)\s+dBFS")}


def estimate_cutoff(x: np.ndarray, sr: int = SR, frame: int = 8192) -> Dict[str, Any]:
    """Frequency above which the average spectrum falls off a cliff (brick-wall low-pass of lossy codecs)."""
    x = np.asarray(x, dtype=np.float64)
    n = (x.size // frame) * frame
    if n < frame * 4:
        return {"cutoff_hz": None, "confidence": 0.0}
    frames = x[:n].reshape(-1, frame) * np.hanning(frame)
    power = (np.abs(np.fft.rfft(frames, axis=1)) ** 2).mean(axis=0)
    db = 10 * np.log10(power + 1e-20)
    freqs = np.fft.rfftfreq(frame, 1 / sr)
    k = max(3, frame // 256)                                      # ~smooth over a few hundred Hz
    sm = np.convolve(db, np.ones(k) / k, mode="same")
    ref = sm[(freqs >= 1000) & (freqs <= 8000)].mean()
    floor = float(np.percentile(sm[freqs >= 0.97 * sr / 2 - 600], 50)) if sr > 40000 else float(sm[-5:].mean())
    # highest frequency still within 40 dB of the 1-8 kHz level
    above = np.where(sm > ref - 40)[0]
    cutoff = float(freqs[above.max()]) if above.size else None
    drop = float(ref - floor)
    return {"cutoff_hz": round(cutoff, 0) if cutoff else None, "drop_db": round(drop, 1), "confidence": round(min(1.0, max(0.0, drop / 60)), 2)}


def classify_cutoff(cutoff_hz: Optional[float], sr: int = SR) -> Dict[str, Any]:
    if not cutoff_hz:
        return {"verdict": "unknown", "lossy_origin": None, "approx_source": None}
    nyq = sr / 2
    if cutoff_hz >= min(21000.0, 0.95 * nyq):
        return {"verdict": "full-band", "lossy_origin": False, "approx_source": "lossless or very high bitrate"}
    if cutoff_hz >= 19500:
        return {"verdict": "borderline", "lossy_origin": None, "approx_source": "MP3 320 / AAC 256+ or a low-passed master"}
    if cutoff_hz >= 16500:
        return {"verdict": "lossy-origin", "lossy_origin": True, "approx_source": "MP3/AAC ~160-256 kbps"}
    return {"verdict": "lossy-origin", "lossy_origin": True, "approx_source": "MP3/AAC <=128 kbps"}


def clipping_stats(x: np.ndarray, thr: float = 0.999) -> Dict[str, Any]:
    x = np.asarray(x)
    hot = np.abs(x) >= thr
    runs = int(((hot[:-2] & hot[1:-1] & hot[2:])).sum()) if x.size > 3 else 0     # >= 3 consecutive hot samples
    return {"clipped_samples": int(hot.sum()), "clip_runs": runs, "fraction": round(float(hot.mean()), 6) if x.size else 0.0}


def edge_silence(env_db: np.ndarray, hop_s: float, floor_db: float = -60.0) -> Dict[str, float]:
    """Seconds of silence at head/tail from a dB envelope (one value per hop)."""
    loud = np.where(env_db > floor_db)[0]
    if loud.size == 0:
        return {"head_s": round(env_db.size * hop_s, 2), "tail_s": round(env_db.size * hop_s, 2)}
    return {"head_s": round(float(loud[0] * hop_s), 2), "tail_s": round(float((env_db.size - 1 - loud[-1]) * hop_s), 2)}


def ending_style(env_db: np.ndarray, hop_s: float) -> Dict[str, Any]:
    """'fade' / 'decay' (natural tail) / 'abrupt' (cut while loud)."""
    loud = np.where(env_db > -60.0)[0]
    if loud.size < 20:
        return {"style": "unknown"}
    body = float(np.median(env_db[loud[0]:loud[-1] + 1]))
    last_s = max(1, int(round(1.5 / hop_s)))
    end = env_db[loud[-1] - last_s + 1: loud[-1] + 1]
    drop = body - float(end.mean())
    slope = float(end[-1] - end[0])
    if drop >= 10 or slope <= -12:
        return {"style": "fade" if slope <= -12 else "decay", "last_1_5s_vs_body_db": round(-drop, 1)}
    return {"style": "abrupt", "last_1_5s_vs_body_db": round(-drop, 1)}


# ───────────────────────────── sync-readiness scoring ─────────────────────────────
def sync_checks(r: Dict[str, Any]) -> Dict[str, Any]:
    checks: List[Dict[str, Any]] = []

    def add(cid: str, ok: Optional[bool], value: Any, note: str, weight: float):
        checks.append({"id": cid, "ok": ok, "value": value, "note": note, "weight": weight})

    ld = r.get("loudness") or {}
    lufs, tp = ld.get("integrated_lufs"), ld.get("true_peak_dbtp")
    if lufs is not None:
        add("loudness", -20.0 <= lufs <= -8.0, lufs, "Integrated loudness should sit between -20 and -8 LUFS for a library master.", 2)
    if tp is not None:
        add("true_peak", tp <= -0.9, tp, "True peak above -1 dBTP risks inter-sample clipping after lossy encoding.", 2)
    cl = r.get("clipping") or {}
    if cl:
        add("clipping", cl.get("clip_runs", 0) == 0, cl.get("clip_runs"), "Runs of full-scale samples = audible digital clipping.", 2)
    sp = r.get("spectrum") or {}
    fmt = r.get("format") or {}
    lossless_container = str(fmt.get("codec", "")).startswith(("pcm", "flac", "alac"))
    if sp.get("lossy_origin") is not None:
        ok = not (lossless_container and sp["lossy_origin"])
        add("true_lossless", ok, sp.get("cutoff_hz"), "Lossless file but the spectrum is cut at %s Hz: decoded from %s." % (sp.get("cutoff_hz"), sp.get("approx_source")) if not ok
            else "Spectrum is consistent with the container.", 2)
    ed = r.get("edges") or {}
    if "head_s" in ed:
        add("head_silence", ed["head_s"] <= 0.5, ed["head_s"], "Leading silence over 0.5 s delays the cue in an edit.", 1)
        add("tail_silence", ed["tail_s"] <= 3.0, ed["tail_s"], "Trailing silence over 3 s.", 0.5)
    end = r.get("ending") or {}
    if end.get("style") not in (None, "unknown"):
        add("ending", end["style"] != "abrupt", end["style"], "The track is cut off while still loud - add a fade or find a natural ending.", 1)
    dur = r.get("duration_s")
    if dur:
        add("duration", 30 <= dur <= 480, round(dur, 1), "Outside 30 s - 8 min.", 0.5)
    scored = [c for c in checks if c["ok"] is not None]
    total = sum(c["weight"] for c in scored) or 1
    score = round(sum(c["weight"] for c in scored if c["ok"]) / total, 2)
    return {"score": score, "grade": "A" if score >= 0.9 else "B" if score >= 0.75 else "C" if score >= 0.55 else "D",
            "ready": score >= 0.75 and all(c["ok"] for c in checks if c["id"] in ("clipping", "true_lossless") and c["ok"] is not None),
            "checks": checks}


# ───────────────────────────── ffmpeg side ─────────────────────────────
def _run(cmd: List[str], timeout: int = 180) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, timeout=timeout)


def probe(path: str) -> Dict[str, Any]:
    out = _run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                "stream=codec_name,sample_rate,channels,bits_per_sample,bit_rate:format=duration,format_name", "-of", "json", path]).stdout
    try:
        j = json.loads(out)
        s, f = (j.get("streams") or [{}])[0], j.get("format") or {}
        return {"codec": s.get("codec_name"), "sampleRate": int(s.get("sample_rate") or 0), "channels": s.get("channels"),
                "bitDepth": int(s.get("bits_per_sample") or 0) or None,
                "bitrateKbps": round(int(s["bit_rate"]) / 1000) if s.get("bit_rate") else None,
                "container": f.get("format_name"), "duration_s": float(f.get("duration") or 0)}
    except (ValueError, KeyError, IndexError):
        return {}


def _decode(path: str, sr: int, start: float = 0.0, seconds: Optional[float] = None) -> np.ndarray:
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start), "-i", path] + (["-t", str(seconds)] if seconds else []) + \
          ["-ac", "1", "-ar", str(sr), "-f", "f32le", "-"]
    return np.frombuffer(_run(cmd, timeout=240).stdout, dtype=np.float32)


def analyze_file(path: str) -> Dict[str, Any]:
    fmt = probe(path)
    dur = fmt.get("duration_s") or 0
    ld = _run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], timeout=300)
    loudness = parse_ebur128(ld.stderr.decode("utf-8", "replace"))
    mid = _decode(path, SR, start=max(0, dur / 2 - 30), seconds=60) if dur else _decode(path, SR, seconds=60)
    spec = estimate_cutoff(mid, SR)
    spec.update(classify_cutoff(spec.get("cutoff_hz"), SR))
    full_hot = clipping_stats(_decode(path, SR, seconds=300)) if dur else {}
    low = _decode(path, 8000)
    hop = 400                                                   # 50 ms at 8 kHz
    n = (low.size // hop) * hop
    env = 20 * np.log10(np.sqrt((low[:n].reshape(-1, hop) ** 2).mean(axis=1)) + 1e-9) if n else np.array([-90.0])
    report = {"format": fmt, "duration_s": dur, "loudness": loudness, "spectrum": spec, "clipping": full_hot,
              "edges": edge_silence(env, hop / 8000), "ending": ending_style(env, hop / 8000)}
    report["syncReadiness"] = sync_checks(report)
    return report
