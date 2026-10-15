"""Hearing: a CLAP audio-language model that actually listens to the track.

The LLM stage of the engine only ever saw DSP numbers. This module adds a real audio model (LAION CLAP,
``laion/clap-htsat-unfused``, ~600 MB, CPU) that embeds the audio and compares it with text prompts, so genre, mood,
instrumentation and "is there a singer" are judged from the sound itself. Results are per-category probabilities plus a
512-d "sonic vector" for similarity search / duplicate detection.

Design rules:
* optional - if ``transformers``/the weights are missing, ``Hearing.available()`` is False and the engine runs as before;
* lazy, one process-wide model, guarded by a lock, torch threads capped so a running web app is not starved;
* pure functions (``rank``, ``pack_vector``) are unit-tested without the model.
"""
from __future__ import annotations

import base64
import logging
import os
import threading
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

logger = logging.getLogger(__name__)

# model weights must survive container rebuilds: keep the Hugging Face cache on the persistent /data volume
if "HF_HOME" not in os.environ and os.path.isdir("/data"):
    os.environ["HF_HOME"] = "/data/hf"

MODEL_NAME = os.getenv("HEARING_MODEL", "laion/clap-htsat-unfused")
SAMPLE_RATE = 48000
CLIP_SECONDS = 10
MAX_CLIPS = int(os.getenv("HEARING_CLIPS", "4"))

# category -> (prompt template, labels)
TAXONOMY: Dict[str, Dict[str, Any]] = {
    "genre": {
        "template": "{} music",
        "labels": [
            "techno", "house", "deep house", "tech house", "progressive house", "trance", "psytrance", "drum and bass",
            "dubstep", "hardstyle", "electro", "synthwave", "ambient", "chillout downtempo", "lo-fi hip hop", "hip hop",
            "trap", "pop", "dance pop", "rock", "indie rock", "metal", "jazz", "neo-soul", "r&b", "soul", "funk",
            "disco", "reggae", "latin", "folk acoustic", "classical orchestral", "cinematic score", "world music",
            "gospel", "country", "polka", "edm festival big room", "melodic techno", "breakbeat",
        ],
    },
    "mood": {
        "template": "{} music",
        "labels": [
            "energetic", "euphoric", "dark", "aggressive", "dreamy", "melancholic", "romantic", "tense and suspenseful",
            "calm and relaxing", "uplifting", "mysterious", "epic and heroic", "playful", "sensual", "nostalgic",
            "hypnotic", "angry", "peaceful", "futuristic", "festive party",
        ],
    },
    "instrument": {
        "template": "music featuring {}",
        "labels": [
            "synthesizer", "electronic drum machine", "acoustic guitar", "electric guitar", "piano", "strings orchestra",
            "brass", "bass guitar", "saxophone", "violin", "accordion", "flute", "choir", "808 bass", "arpeggiated synth",
            "pads", "live drums",
        ],
    },
    # Calibrated 2026-10-15 on 22 reference tracks (12 DJ instrumentals, 10 vocal songs): this 3-prompt set separated them with
    # 96 % balanced accuracy; the earlier 2-5 prompt variants reached 79-91 %. Thresholds below come from the same run.
    "vocal": {
        "template": "{}",
        "labels": ["purely instrumental music", "a female singer singing", "a male singer singing"],
    },
}
VOCAL_NONE = "purely instrumental music"
VOCAL_FEMALE, VOCAL_MALE = "a female singer singing", "a male singer singing"
P_INSTRUMENTAL = 0.80      # >= this: confidently instrumental
P_VOCAL = 0.50             # <= this: a singer is present; in between = unclear

_lock = threading.Lock()
_state: Dict[str, Any] = {"model": None, "proc": None, "text": None, "failed": None}


# ───────────────────────── pure helpers (unit-tested) ─────────────────────────
def softmax(x: np.ndarray, scale: float = 1.0) -> np.ndarray:
    z = np.asarray(x, dtype=np.float64) * scale
    z = z - z.max()
    e = np.exp(z)
    return e / e.sum()


def rank(labels: Sequence[str], cosines: np.ndarray, scale: float, top: int = 5, min_prob: float = 0.02) -> List[Dict[str, Any]]:
    """Top labels with softmax probability, plus the raw cosine (evidence strength)."""
    probs = softmax(cosines, scale)
    order = np.argsort(-probs)[:top]
    return [{"label": labels[i], "p": round(float(probs[i]), 3), "cos": round(float(cosines[i]), 3)} for i in order if probs[i] >= min_prob]


def pack_vector(vec: np.ndarray) -> str:
    """L2-normalised float16 vector -> base64 (1 KB for 512-d)."""
    v = np.asarray(vec, dtype=np.float32)
    n = np.linalg.norm(v)
    if n > 0:
        v = v / n
    return base64.b64encode(v.astype(np.float16).tobytes()).decode("ascii")


def unpack_vector(b64: str) -> np.ndarray:
    return np.frombuffer(base64.b64decode(b64), dtype=np.float16).astype(np.float32)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    return float(np.dot(a, b) / (na * nb)) if na and nb else 0.0


def vocal_verdict(vocal_probs: Dict[str, float]) -> Dict[str, Any]:
    """Turn the vocal category into a verdict. Instrumental needs >= 0.80, a singer <= 0.50; the middle stays None (unclear)."""
    none_p = vocal_probs.get(VOCAL_NONE, 0.0)
    f, m = vocal_probs.get(VOCAL_FEMALE, 0.0), vocal_probs.get(VOCAL_MALE, 0.0)
    if none_p >= P_INSTRUMENTAL:
        has = False
    elif none_p <= P_VOCAL:
        has = True
    else:
        has = None
    gender = None
    if has and (f + m) > 0:
        share_f = f / (f + m)
        gender = "female" if share_f >= 0.65 else "male" if share_f <= 0.35 else "mixed"
    return {"hasVocals": has, "pInstrumental": round(none_p, 3), "pVocal": round(1.0 - none_p, 3), "gender": gender}


def clip_starts(n_samples: int, sr: int = SAMPLE_RATE, clips: int = MAX_CLIPS, seconds: int = CLIP_SECONDS) -> List[int]:
    """Evenly spaced clip start offsets, skipping the first/last 8% (intros/outros are unrepresentative)."""
    win = seconds * sr
    if n_samples <= win:
        return [0]
    lo, hi = int(n_samples * 0.08), int(n_samples * 0.92) - win
    if hi <= lo:
        return [max(0, (n_samples - win) // 2)]
    return [int(s) for s in np.linspace(lo, hi, clips)]


# ───────────────────────── model side ─────────────────────────
def _load() -> bool:
    if _state["model"] is not None:
        return True
    if _state["failed"]:
        return False
    with _lock:
        if _state["model"] is not None:
            return True
        try:
            import torch
            from transformers import ClapModel, ClapProcessor

            torch.set_num_threads(int(os.getenv("HEARING_THREADS", "3")))
            proc = ClapProcessor.from_pretrained(MODEL_NAME)
            model = ClapModel.from_pretrained(MODEL_NAME).eval()
            text: Dict[str, Any] = {}
            with torch.no_grad():
                for cat, spec in TAXONOMY.items():
                    prompts = [spec["template"].format(lbl) for lbl in spec["labels"]]
                    ti = proc(text=prompts, return_tensors="pt", padding=True)
                    t = model.get_text_features(**ti)
                    text[cat] = (t / t.norm(dim=-1, keepdim=True)).numpy()
            _state.update(model=model, proc=proc, text=text, scale=float(model.logit_scale_a.exp().item()))
            logger.info("Hearing model %s loaded", MODEL_NAME)
            return True
        except Exception as e:  # noqa: BLE001 - optional capability
            _state["failed"] = str(e)[:200]
            logger.warning("Hearing model unavailable: %s", e)
            return False


def available() -> bool:
    if os.getenv("HEARING_ENABLED", "true").lower() in ("0", "false", "no"):
        return False
    return _load()


def listen(file_path: str) -> Optional[Dict[str, Any]]:
    """Blocking (run in a thread). Returns None when the model is unavailable."""
    if not available():
        return None
    import librosa
    import torch

    y, _ = librosa.load(file_path, sr=SAMPLE_RATE, mono=True)
    if y.size < SAMPLE_RATE:
        return None
    win = CLIP_SECONDS * SAMPLE_RATE
    clips = [y[s:s + win] for s in clip_starts(y.size)]
    clips = [c for c in clips if c.size > SAMPLE_RATE]
    proc, model = _state["proc"], _state["model"]
    with _lock, torch.no_grad():
        ai = proc(audios=clips, sampling_rate=SAMPLE_RATE, return_tensors="pt")
        a = model.get_audio_features(**ai)
    a = (a / a.norm(dim=-1, keepdim=True)).numpy()           # per clip
    mean = a.mean(axis=0)
    mean = mean / np.linalg.norm(mean)
    out: Dict[str, Any] = {"model": MODEL_NAME, "clips": len(clips)}
    scale = _state["scale"]
    for cat, spec in TAXONOMY.items():
        cos = _state["text"][cat] @ mean
        out[cat] = rank(spec["labels"], cos, scale, top=6 if cat != "vocal" else 3)
    gcos = _state["text"]["genre"] @ mean
    out["scale"] = round(float(scale), 3)
    out["genre_all"] = [{"label": lbl, "cos": round(float(c), 4)} for lbl, c in zip(TAXONOMY["genre"]["labels"], gcos)]
    vprobs = softmax(_state["text"]["vocal"] @ mean, scale)
    out["vocal_verdict"] = vocal_verdict({lbl: float(p) for lbl, p in zip(TAXONOMY["vocal"]["labels"], vprobs)})
    out["sonicVector"] = pack_vector(mean)
    # stability: do the clips agree on the top genre?
    tops = [TAXONOMY["genre"]["labels"][int(np.argmax(_state["text"]["genre"] @ c))] for c in a]
    out["genre_agreement"] = round(tops.count(max(set(tops), key=tops.count)) / len(tops), 2)
    return out


# ───────────────────────── text -> audio space (semantic search) ─────────────────────────
from collections import OrderedDict  # noqa: E402

_TEXT_CACHE: "OrderedDict[str, np.ndarray]" = OrderedDict()
_TEXT_CACHE_MAX = 1024


def embed_text(queries: Sequence[str]) -> Optional[List[np.ndarray]]:
    """Unit-length CLAP text embeddings for free-text queries (same space as the track ``sonicVector``).
    ``cosine(embed_text(q)[0], unpack_vector(track_vector))`` ranks tracks by how well they *sound* like the query."""
    if not available():
        return None
    queries = [str(q).strip()[:300] for q in queries]
    todo = [q for q in dict.fromkeys(queries) if q and q not in _TEXT_CACHE]
    if todo:
        import torch

        with _lock, torch.no_grad():
            ti = _state["proc"](text=todo, return_tensors="pt", padding=True, truncation=True)
            t = _state["model"].get_text_features(**ti)
        t = (t / t.norm(dim=-1, keepdim=True)).numpy()
        for q, v in zip(todo, t):
            _TEXT_CACHE[q] = v
            while len(_TEXT_CACHE) > _TEXT_CACHE_MAX:
                _TEXT_CACHE.popitem(last=False)
    return [_TEXT_CACHE.get(q, np.zeros(512, dtype=np.float32)) for q in queries]


def semantic_rank(query_vec: np.ndarray, items: Sequence[Dict[str, Any]], top: int = 20) -> List[Dict[str, Any]]:
    """items: [{'id', 'vector': b64}] -> best first with cosine score."""
    scored = []
    for it in items:
        try:
            scored.append({"id": it.get("id"), "score": round(cosine(query_vec, unpack_vector(it["vector"])), 4)})
        except (KeyError, ValueError, TypeError):
            continue
    scored.sort(key=lambda x: -x["score"])
    return scored[:top]
