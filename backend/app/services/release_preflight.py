"""Release preflight: "will a distributor or store reject this?" in one checklist.

Everything here is a pure function of facts the engine has already measured (technical QC, the audio fingerprint answer, the metadata the
user typed, the user's own earlier analyses, the cover image), so it can be tested without audio or network. The rules are the ones
distributors and stores commonly enforce; each distributor adds its own, so the verdict says "common requirements", never "approved".
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

PASS, WARN, FAIL, SKIP = "pass", "warn", "fail", "skip"
DISCLAIMER = ("These are requirements distributors and stores commonly enforce. Each one has its own rules and review process, "
              "so a clean result is not an approval; check the rules of the service you submit to.")
GENERIC_TITLES = {"untitled", "unknown", "track", "track 1", "new song", "demo", "master", "final", "mix", "unknown title"}
GENERIC_ARTISTS = {"unknown", "unknown artist", "artist", "various", "n/a", "none"}
LOSSY = {"mp3", "aac", "ogg", "vorbis", "opus", "wma", "mp2", "ac3"}


def _c(cid: str, title: str, level: str, detail: str, fix: Optional[str] = None) -> Dict[str, Any]:
    return {"id": cid, "title": title, "level": level, "detail": detail, **({"fix": fix} if fix else {})}


def valid_isrc(code: str) -> bool:
    return bool(re.fullmatch(r"[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}", (code or "").replace("-", "").upper()))


def valid_upc(code: str) -> bool:
    """GTIN-12/13/14 with its check digit (UPC-A and EAN-13 are the ones release forms ask for)."""
    digits = re.sub(r"[\s-]", "", code or "")
    if not digits.isdigit() or len(digits) not in (12, 13, 14):
        return False
    body, check = digits[:-1], int(digits[-1])
    total = sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(body)))
    return (10 - total % 10) % 10 == check


def technical_checks(qc: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    fmt = qc.get("format") or {}
    codec = str(fmt.get("codec") or "").lower()
    container = str(fmt.get("container") or "").lower()
    lossy = any(k in codec for k in LOSSY) or any(k in container for k in LOSSY)
    sr, ch, bits = fmt.get("sampleRate"), fmt.get("channels"), fmt.get("bitDepth")
    dur = qc.get("duration_s") or fmt.get("duration_s") or 0

    if lossy:
        out.append(_c("format", "File format", WARN, f"The file is lossy ({codec or container}). Distributors want WAV or FLAC; a lossy upload is encoded a second time.",
                      "Upload the lossless master (WAV or FLAC, 16 or 24 bit)."))
    else:
        out.append(_c("format", "File format", PASS, f"Lossless ({codec or container})."))
    if sr:
        out.append(_c("sample_rate", "Sample rate", PASS if sr >= 44100 else FAIL,
                      f"{sr} Hz." + ("" if sr >= 44100 else " Stores require at least 44.1 kHz."), None if sr >= 44100 else "Export again at 44.1 kHz or higher."))
    if bits and not lossy:
        out.append(_c("bit_depth", "Bit depth", PASS if bits >= 16 else FAIL, f"{bits}-bit." + ("" if bits >= 16 else " At least 16-bit is required."),
                      None if bits >= 16 else "Export at 16 or 24 bit."))
    if ch:
        lvl = PASS if ch == 2 else WARN if ch == 1 else FAIL
        det = "Stereo." if ch == 2 else "Mono. Accepted by some stores, but it will sound narrow next to stereo releases." if ch == 1 else f"{ch} channels. Stores take stereo."
        out.append(_c("channels", "Channels", lvl, det, None if ch == 2 else "Deliver a stereo file." if ch > 2 else "Make a stereo version unless mono is intended."))
    if dur:
        lvl = PASS if dur >= 30 else WARN if dur >= 10 else FAIL
        out.append(_c("duration", "Length", lvl, f"{dur:.0f} s." + ("" if dur >= 30 else " Under 30 s it may not count as a track or be paid as a stream."),
                      None if dur >= 30 else "Check that this is the full track."))
    spec = qc.get("spectrum") or {}
    if spec.get("lossy_origin"):
        out.append(_c("lossy_origin", "Source quality", WARN,
                      f"The spectrum is cut off near {round((spec.get('cutoff_hz') or 0) / 1000, 1)} kHz, typical of an MP3 or AAC decoded to WAV. Stores that sell lossless files may reject it.",
                      "Deliver the original lossless export from your DAW or generator."))
    elif spec:
        out.append(_c("lossy_origin", "Source quality", PASS, "The spectrum reaches full bandwidth: no sign of a lossy source."))
    clip = qc.get("clipping") or {}
    if clip:
        runs, frac = clip.get("clip_runs", 0) or 0, clip.get("fraction", 0) or 0
        lvl = FAIL if frac > 5e-4 else WARN if runs > 5 else PASS
        out.append(_c("clipping", "Clipping", lvl, f"{clip.get('clipped_samples', 0)} clipped samples in {runs} runs." + ("" if lvl == PASS else " Audible distortion; some distributors reject it."),
                      None if lvl == PASS else "Lower the level before the limiter or repair the clipped passages, then export again."))
    loud = qc.get("loudness") or {}
    tp, lufs = loud.get("true_peak_dbtp"), loud.get("integrated_lufs")
    if tp is not None:
        lvl = FAIL if tp > 0 else WARN if tp > -1 else PASS
        out.append(_c("true_peak", "True peak", lvl, f"{tp:.1f} dBTP." + ("" if lvl == PASS else " It can clip after the store re-encodes the file."),
                      None if lvl == PASS else "Set the limiter ceiling to -1 dBTP or lower."))
    if lufs is not None:
        lvl = WARN if (lufs < -24 or lufs > -6) else PASS
        out.append(_c("loudness", "Loudness", lvl, f"{lufs:.1f} LUFS." + (" Very quiet next to other releases." if lufs < -24 else " Streaming services will turn it down." if lufs > -6 else ""),
                      None if lvl == PASS else "Streaming targets sit around -14 LUFS; master closer to that."))
    edges = qc.get("edges") or {}
    if edges:
        head, tail = edges.get("head_s", 0) or 0, edges.get("tail_s", 0) or 0
        bad = head > 2 or tail > 8
        out.append(_c("silence", "Silence at the ends", WARN if bad else PASS,
                      f"{head:.1f} s at the start, {tail:.1f} s at the end." + (" Long silence is rejected by some stores and wastes the listener's time." if bad else ""),
                      "Trim the silence." if bad else None))
    end = (qc.get("ending") or {}).get("style")
    if end == "abrupt":
        out.append(_c("ending", "Ending", WARN, "The track stops abruptly, without a fade or a natural tail.", "Add a fade-out or let the last note ring."))
    return out


def metadata_checks(meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    title = (meta.get("title") or "").strip()
    artist = (meta.get("artist") or "").strip()
    if not title or title.lower() in GENERIC_TITLES or re.search(r"\.(wav|mp3|flac|aiff?|m4a)$", title, re.I):
        out.append(_c("title", "Title", FAIL, "The title is missing or looks like a placeholder or a file name.", "Enter the real title."))
    else:
        problems = []
        if title != meta.get("title"):
            problems.append("leading or trailing spaces")
        if re.search(r"\b(feat\.?|ft\.?|featuring)\b", title, re.I):
            problems.append("a featured artist inside the title (it belongs in the artist field)")
        if len(title) > 4 and title == title.upper() and re.search(r"[A-Z]{4}", title):
            problems.append("ALL CAPS (stores ask for normal capitalisation)")
        if title.endswith("."):
            problems.append("a trailing full stop")
        if re.search(r"[\U0001F300-\U0001FAFF☀-➿]", title):
            problems.append("emoji")
        out.append(_c("title", "Title", WARN if problems else PASS, ("Title contains " + ", ".join(problems) + ".") if problems else f"“{title}”.",
                      "Fix the formatting; stores often reject or rewrite such titles." if problems else None))
    if not artist or artist.lower() in GENERIC_ARTISTS:
        out.append(_c("artist", "Artist", FAIL, "The artist name is missing or generic.", "Enter the artist name exactly as it should appear on stores."))
    else:
        out.append(_c("artist", "Artist", PASS, artist))
    isrc = (meta.get("isrc") or "").strip()
    if isrc:
        out.append(_c("isrc", "ISRC", PASS if valid_isrc(isrc) else FAIL, isrc if valid_isrc(isrc) else f"“{isrc}” is not a valid ISRC (CC-XXX-YY-NNNNN).",
                      None if valid_isrc(isrc) else "Check the code with your ISRC issuer; distributors can also assign one."))
    else:
        out.append(_c("isrc", "ISRC", SKIP, "No ISRC given. Most distributors assign one for free."))
    upc = (meta.get("upc") or "").strip()
    if upc:
        out.append(_c("upc", "UPC / EAN", PASS if valid_upc(upc) else FAIL, upc if valid_upc(upc) else f"“{upc}” has the wrong length or a wrong check digit.",
                      None if valid_upc(upc) else "Use the 12- or 13-digit code from your barcode issuer, or let the distributor assign one."))
    else:
        out.append(_c("upc", "UPC / EAN", SKIP, "No UPC given. Distributors assign one when you do not have your own."))
    if (meta.get("composer") or "").strip():
        out.append(_c("credits", "Songwriter credit", PASS, f"Composer: {meta['composer'].strip()}."))
    else:
        out.append(_c("credits", "Songwriter credit", WARN, "No composer is named. Distributors and collecting societies need the songwriters to pay publishing royalties.",
                      "Add the composer / songwriter names and their shares."))
    return out


def fingerprint_check(fp: Optional[Dict[str, Any]], declared_artist: str = "") -> Dict[str, Any]:
    """`fp` is the ACRCloud JSON answer, or None when the service is not configured or unreachable."""
    if fp is None:
        return _c("fingerprint", "Matches an existing recording?", SKIP, "The fingerprint service could not be reached, so this was not checked.")
    code = ((fp.get("status") or {}).get("code"))
    music = ((fp.get("metadata") or {}).get("music")) or []
    if code == 1001 or (code == 0 and not music):
        return _c("fingerprint", "Matches an existing recording?", PASS, "No existing recording matched the audio fingerprint.")
    if code != 0:
        return _c("fingerprint", "Matches an existing recording?", SKIP, f"The fingerprint service answered with code {code}; not checked.")
    best = max(music, key=lambda m: m.get("score") or 0)
    artists = [(a.get("name") or "").strip() for a in best.get("artists") or []]
    names = ", ".join(a for a in artists if a) or "unknown artist"
    score = best.get("score") or 0
    same = bool(declared_artist.strip()) and declared_artist.strip().lower() in [a.lower() for a in artists]     # whole-name match: "A" is not inside "Famous Band"
    if score < 70:
        return _c("fingerprint", "Matches an existing recording?", PASS, f"A weak partial match ({score}) was ignored.")
    return _c("fingerprint", "Matches an existing recording?", WARN if same else FAIL,
              f"The audio matches “{best.get('title', '?')}” by {names} (score {score})." + (" That is your own artist name: is this already released?" if same else " A distributor will flag it as a copy, cover or sample."),
              "If it is your release, do not submit it twice. If it contains a sample or is a cover, clear the rights first." if not same else "Make sure you are not delivering a track that is already live.")


def own_duplicate_check(matches: List[Dict[str, Any]], title: str = "") -> Dict[str, Any]:
    """`matches`: earlier analyses by the same user with the same SHA-256, as [{"title":..,"file_name":..}]."""
    if not matches:
        return _c("own_duplicate", "Already in your history?", PASS, "This exact file has not been analysed on your account before.")
    other = [m for m in matches if (m.get("title") or "").strip().lower() != (title or "").strip().lower()]
    names = ", ".join(f"“{m.get('title') or m.get('file_name')}”" for m in matches[:3])
    if other:
        return _c("own_duplicate", "Already in your history?", WARN, f"This exact file was analysed before under another title: {names}.", "Release it once, under one title.")
    return _c("own_duplicate", "Already in your history?", PASS, f"Analysed before as {names} (same title).")


def cover_check(cover: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """`cover`: {"width","height","format","bytes"} read from the image, or None when none was supplied."""
    if not cover:
        return _c("cover", "Cover art", SKIP, "No cover image was supplied. Stores need a square JPG or PNG of at least 3000 x 3000 px.")
    w, h, fmt = cover.get("width", 0), cover.get("height", 0), str(cover.get("format") or "").upper()
    problems, level = [], PASS
    if fmt not in ("JPEG", "PNG"):
        problems.append(f"format {fmt or 'unknown'} (use JPG or PNG)"); level = FAIL
    if w != h:
        problems.append(f"not square ({w} x {h})"); level = FAIL
    if min(w, h) < 1400:
        problems.append(f"too small ({w} x {h}, at least 1400 px; 3000 x 3000 preferred)"); level = FAIL
    elif min(w, h) < 3000:
        problems.append(f"{w} x {h} px: below the 3000 x 3000 most stores ask for"); level = level if level == FAIL else WARN
    return _c("cover", "Cover art", level, f"{w} x {h} px, {fmt}." if not problems else "Cover is " + "; ".join(problems) + ".",
              None if not problems else "Export a square 3000 x 3000 px JPG or PNG without text that stores forbid (prices, URLs).")


def evaluate(qc: Optional[Dict[str, Any]], meta: Dict[str, Any], fingerprint: Optional[Dict[str, Any]] = None, fingerprint_checked: bool = True,
             own_matches: Optional[List[Dict[str, Any]]] = None, cover: Optional[Dict[str, Any]] = None, cover_given: bool = False) -> Dict[str, Any]:
    checks: List[Dict[str, Any]] = []
    checks += technical_checks(qc or {})
    checks += metadata_checks(meta)
    checks.append(fingerprint_check(fingerprint if fingerprint_checked else None, meta.get("artist") or ""))
    checks.append(own_duplicate_check(own_matches or [], meta.get("title") or ""))
    checks.append(cover_check(cover if cover_given else None))
    counts = {k: sum(1 for c in checks if c["level"] == k) for k in (PASS, WARN, FAIL, SKIP)}
    verdict = "fix" if counts[FAIL] else "review" if counts[WARN] else "ready"
    headline = {"fix": f"{counts[FAIL]} problem(s) to fix before you submit.", "review": f"No blockers, {counts[WARN]} thing(s) worth a look.",
                "ready": "Nothing found that distributors commonly reject."}[verdict]
    return {"verdict": verdict, "headline": headline, "counts": counts, "checks": checks, "disclaimer": DISCLAIMER}
