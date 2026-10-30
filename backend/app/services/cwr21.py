"""CWR 2.1 (Common Works Registration) files: new work registrations (NWR) in the layout the societies' systems read.

This replaces two earlier generators that wrote record types which do not exist in CWR (WRK, GRL), a wrong EDI version in the header,
counters that did not count, a hard-coded 50 % publisher share and placeholder agreement numbers. The record layouts here follow the CISAC
functional specification (field order, start positions, sizes, record prefix and counter rules) and the output was parsed with the
independent open-source parser CWR-DataApi (see scripts/validate_cwr_with_cwrapi.py).

What a file can and cannot do:
  * It is structurally valid when the shares add up (the rules below are the specification's own) - `build_file` refuses anything else.
  * A society only accepts it from an approved CWR participant: the sender ID (IPI number) the society issued, the publisher's and writers'
    IPI numbers, society codes and agreements. Those cannot be invented, so when they are missing the file is still produced but is marked
    DRAFT (file name prefix, `submittable=False`, and a list of what is missing). Acceptance by a society is not verified by us.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Sequence, Tuple

DESIGNATIONS = {"A ", "AD", "AR", "C ", "CA", "PA", "SA", "SR", "TR"}
WRITER_ROLES_OK = {"CA", "C ", "A "}                 # at least one of these must exist (spec rule 15)
PUBLISHER_TYPES = {"AQ", "AM", "PA", "E ", "ES", "SE"}
CATEGORIES = {"JAZ", "POP", "SER", "UNC"}
TOLERANCE = Decimal("0.06")                           # the specification allows +/- 0.06 % on share totals
WORLD = "2136"                                        # TIS numeric code for "World"

_SPECIAL = {"ł": "l", "Ł": "L", "ø": "o", "Ø": "O", "đ": "d", "Đ": "D", "ß": "ss", "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE"}


def ascii_upper(value: Any) -> str:
    """CWR text is ASCII and upper case: transliterate (Polish letters included) and drop what cannot be represented."""
    s = "" if value is None else str(value)
    s = "".join(_SPECIAL.get(c, c) for c in s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[\r\n\t]+", " ", s)
    return "".join(c for c in s if 32 <= ord(c) < 127).upper()


def A(value: Any, width: int) -> str:
    return ascii_upper(value)[:width].ljust(width)


def N(value: Any, width: int) -> str:
    n = int(value or 0)
    if n < 0 or len(str(n)) > width:
        raise ValueError(f"{value} does not fit a numeric field of {width} digits")
    return str(n).zfill(width)


def share(x: Any) -> str:
    """Percentage as the 5-character 999v99 field: 50 -> 05000, 33.34 -> 03334."""
    d = Decimal(str(x or 0).replace(",", "."))
    return N(int((d * 100).quantize(Decimal("1"))), 5)


def date8(d: Any) -> str:
    if not d:
        return " " * 8
    s = re.sub(r"\D", "", str(d))
    return s[:8].ljust(8) if len(s) >= 8 else " " * 8


def hhmmss(seconds: Any) -> str:
    try:
        s = int(float(seconds))
    except (TypeError, ValueError):
        return "000000"
    return f"{s // 3600:02d}{(s % 3600) // 60:02d}{s % 60:02d}" if 0 < s < 360000 else "000000"


def norm_iswc(code: Any) -> Optional[str]:
    c = re.sub(r"[^A-Za-z0-9]", "", str(code or "")).upper()
    return c if re.fullmatch(r"T\d{10}", c) else None


def digits(value: Any, width: int) -> str:
    d = re.sub(r"\D", "", str(value or ""))
    return d.zfill(width)[-width:] if d else " " * width


@dataclass
class Result:
    text: str
    filename: str
    submittable: bool
    missing: List[str] = field(default_factory=list)       # what a society will need that we were not given
    notes: List[str] = field(default_factory=list)
    counts: Dict[str, int] = field(default_factory=dict)


# ───────────────────────────── validation ─────────────────────────────
def _d(v: Any, label: str, errors: List[str]) -> Decimal:
    if v in (None, ""):
        return Decimal(0)
    try:
        x = Decimal(str(v).replace(",", "."))
    except InvalidOperation:
        errors.append(f"{label}: “{v}” is not a number.")
        return Decimal(0)
    if x < 0 or x > 100:
        errors.append(f"{label}: a share must be between 0 and 100.")
    return x


def validate_work(work: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """Returns (normalised work, errors that stop a file being written, missing items that make it a draft)."""
    errors: List[str] = []
    missing: List[str] = []
    title = ascii_upper(work.get("title")).strip()
    if not title:
        errors.append("The work needs a title.")
    category = (work.get("category") or "POP").upper()
    if category not in CATEGORIES:
        errors.append(f"Distribution category must be one of {', '.join(sorted(CATEGORIES))}.")
    if category == "SER" and hhmmss(work.get("duration_seconds")) == "000000":
        errors.append("Serious (SER) works need a duration greater than zero.")

    writers_in = work.get("writers") or []
    publishers_in = work.get("publishers") or []
    writers, publishers = [], []
    for i, w in enumerate(writers_in, 1):
        label = f"Writer {i}"
        last = ascii_upper(w.get("last_name")).strip()
        if not last:
            errors.append(f"{label} has no last name.")
        des = (str(w.get("designation") or "CA").upper() + " ")[:2]
        if des not in DESIGNATIONS:
            errors.append(f"{label}: designation “{des.strip()}” is not a CWR writer designation ({', '.join(sorted(d.strip() for d in DESIGNATIONS))}).")
        writers.append({"id": w.get("id") or f"W{i:03d}", "last": last, "first": ascii_upper(w.get("first_name")).strip(), "designation": des,
                        "ipi_name": digits(w.get("ipi_name"), 11).strip(), "ipi_base": ascii_upper(w.get("ipi_base")).strip(), "society": digits(w.get("society"), 3).strip(),
                        "pr": _d(w.get("pr_share"), f"{label} PR share", errors), "mr": _d(w.get("mr_share"), f"{label} MR share", errors),
                        "sr": _d(w.get("sr_share"), f"{label} SR share", errors), "publisher_ref": w.get("publisher_ref"), "name": f"{last} {ascii_upper(w.get('first_name'))}".strip()})
    for i, p in enumerate(publishers_in, 1):
        label = f"Publisher {i}"
        ptype = (str(p.get("type") or "E") + " ")[:2].upper()
        if ptype not in PUBLISHER_TYPES:
            errors.append(f"{label}: type “{ptype.strip()}” is not a CWR publisher type.")
        name = ascii_upper(p.get("name")).strip()
        if not name:
            errors.append(f"{label} has no name.")
        publishers.append({"id": p.get("id") or f"P{i:03d}", "name": name, "type": ptype, "ipi_name": digits(p.get("ipi_name"), 11).strip(),
                           "ipi_base": ascii_upper(p.get("ipi_base")).strip(), "society": digits(p.get("society"), 3).strip(),
                           "agreement": ascii_upper(p.get("agreement_number")).strip(), "society_agreement": ascii_upper(p.get("society_agreement_number")).strip(),
                           "pr": _d(p.get("pr_share"), f"{label} PR share", errors), "mr": _d(p.get("mr_share"), f"{label} MR share", errors),
                           "sr": _d(p.get("sr_share"), f"{label} SR share", errors)})

    if not writers:
        errors.append("A work registration needs at least one writer.")
    elif not any(w["designation"] in WRITER_ROLES_OK for w in writers):
        errors.append("At least one writer must be a composer/author (CA, C or A).")
    version = (work.get("version_type") or "ORI").upper()
    if version == "ORI" and any(w["designation"] in {"AR", "AD", "SR", "SA", "TR"} for w in writers):
        errors.append("An original work cannot have an arranger, adapter or translator; arrangements need a MOD registration, which is not supported yet.")
    if version == "MOD":
        errors.append("MOD (arrangement) registrations are not supported yet.")

    wr = {k: sum((w[k] for w in writers), Decimal(0)) for k in ("pr", "mr", "sr")}
    pb = {k: sum((p[k] for p in publishers), Decimal(0)) for k in ("pr", "mr", "sr")}
    for k, label in (("pr", "performing (PR)"), ("mr", "mechanical (MR)"), ("sr", "synchronisation (SR)")):
        total = wr[k] + pb[k]
        if abs(total - 100) > TOLERANCE and total != 0:
            errors.append(f"The {label} shares add up to {total}, not 100 (writers {wr[k]} + publishers {pb[k]}).")
    if writers and wr["pr"] != 0 and wr["pr"] < 50 - TOLERANCE:
        errors.append(f"Writers must hold at least 50 % of the performing right (CWR rule); they hold {wr['pr']} %.")
    if pb["pr"] > 50 + TOLERANCE:
        errors.append(f"Publishers can hold at most 50 % of the performing right (CWR rule); they hold {pb['pr']} %.")
    for k in ("mr", "sr"):
        if pb[k] > 100 + TOLERANCE:
            errors.append(f"Publisher {k.upper()} shares exceed 100.")
    published = bool(publishers)
    refs = {p["id"] for p in publishers}
    for w in writers:
        if w["publisher_ref"] and w["publisher_ref"] not in refs:
            errors.append(f"Writer {w['name']} points to the publisher “{w['publisher_ref']}”, which is not in the list.")
        if published and not w["publisher_ref"] and len(publishers) > 1:
            errors.append(f"Writer {w['name']} must say which publisher represents them (publisher_ref), because there are several.")

    for w in writers:
        if not w["ipi_name"]:
            missing.append(f"IPI name number of writer {w['name'] or w['id']}")
        if not w["society"]:
            missing.append(f"performing-rights society code of writer {w['name'] or w['id']}")
    for p in publishers:
        if not p["ipi_name"]:
            missing.append(f"IPI name number of publisher {p['name'] or p['id']} (mandatory for a publisher the submitter controls)")
        if not p["society"]:
            missing.append(f"society code of publisher {p['name'] or p['id']}")
    iswc = norm_iswc(work.get("iswc"))
    text_music = (work.get("text_music_relationship") or "").upper()
    norm = {"title": title, "language": (work.get("language") or "").upper()[:2], "submitter_work_number": ascii_upper(work.get("submitter_work_number")).strip() or None,
            "iswc": iswc, "category": category, "duration": hhmmss(work.get("duration_seconds")), "recorded": "Y" if work.get("recorded", True) else "N",
            "text_music": text_music if text_music in {"MUS", "MTX", "TXT"} else "   ", "version": "ORI", "copyright_date": date8(work.get("copyright_date")),
            "writers": writers, "publishers": publishers, "published": published, "contact": ascii_upper(work.get("contact_name")).strip()}
    return norm, errors, missing


# ───────────────────────────── records ─────────────────────────────
def hdr(sender: Dict[str, Any], now: datetime) -> Tuple[str, bool]:
    """The character set field is only for files that are NOT ASCII, so it stays blank."""
    stype = (sender.get("type") or "PB").upper()[:2]
    sid = digits(sender.get("id"), 9)
    ok = sid.strip() != ""
    return ("HDR" + A(stype, 2) + (sid if ok else "0" * 9) + A(sender.get("name"), 45) + "01.10" + now.strftime("%Y%m%d%H%M%S") + now.strftime("%Y%m%d") + A("", 15)), ok


def _prefix(rtype: str, trans: int, rec: int) -> str:
    return rtype + N(trans, 8) + N(rec, 8)


def work_records(w: Dict[str, Any], trans: int, submitter_number: str) -> List[str]:
    """One NWR transaction: the header record and its detail records, in the order the specification lists them."""
    out: List[str] = []
    seq = 0

    def add(rtype: str, body: str) -> None:
        nonlocal seq
        out.append(_prefix(rtype, trans, seq) + body)
        seq += 1                                           # NWR is record 0; every detail record is the previous one + 1

    add("NWR", A(w["title"], 60) + A(w["language"], 2) + A(submitter_number, 14) + A(w["iswc"] or "", 11) + w["copyright_date"] + A("", 12) + A(w["category"], 3)
        + w["duration"] + A(w["recorded"], 1) + A(w["text_music"], 3) + A("", 3) + A(w["version"], 3)
        + A("", 3) + A("", 3) + A("", 3) + A(w["contact"], 30) + A("", 10) + A("", 2) + A("", 1) + A("", 3)
        + " " * 8 + A("", 1) + A("", 25) + A("", 25) + A("", 1))
    pubs = w["publishers"]
    for n, p in enumerate(pubs, 1):
        add("SPU", N(n, 2) + A(p["id"], 9) + A(p["name"], 45) + A("", 1) + A(p["type"], 2) + A("", 9) + A(p["ipi_name"], 11) + A(p["agreement"], 14)
            + A(p["society"], 3) + share(p["pr"]) + A(p["society"], 3) + share(p["mr"]) + A(p["society"], 3) + share(p["sr"]) + A("", 1) + A("", 1) + A("", 1)
            + A(p["ipi_base"], 13) + A("", 14) + A(p["society_agreement"], 14) + A("", 2) + A("", 1))
        add("SPT", A(p["id"], 9) + " " * 6 + share(p["pr"]) + share(p["mr"]) + share(p["sr"]) + "I" + WORLD + A("", 1) + "001")
    ids = {p["id"]: n for n, p in enumerate(pubs, 1)}
    for wr in w["writers"]:
        add("SWR", A(wr["id"], 9) + A(wr["last"], 45) + A(wr["first"], 30) + A("", 1) + A(wr["designation"], 2) + A("", 9) + A(wr["ipi_name"], 11)
            + A(wr["society"], 3) + share(wr["pr"]) + A(wr["society"], 3) + share(wr["mr"]) + A(wr["society"], 3) + share(wr["sr"]) + A("", 1) + A("", 1) + A("", 1) + A("", 1)
            + A(wr["ipi_base"], 13) + A("", 12) + A("", 1))
        add("SWT", A(wr["id"], 9) + share(wr["pr"]) + share(wr["mr"]) + share(wr["sr"]) + "I" + WORLD + A("", 1) + "001")
        if w["published"]:
            ref = wr["publisher_ref"] or (pubs[0]["id"] if pubs else None)
            if ref in ids:
                p = pubs[ids[ref] - 1]
                add("PWR", A(p["id"], 9) + A(p["name"], 45) + A(p["agreement"], 14) + A(p["society_agreement"], 14) + A(wr["id"], 9))
    return out


def build_file(sender: Dict[str, Any], works: Sequence[Dict[str, Any]], *, now: Optional[datetime] = None, file_sequence: int = 1,
               receiver_code: str = "000", sender_code: str = "") -> Result:
    """One CWR 2.1 file: HDR, one NWR group with a transaction per work, GRT, TRL. Raises ValueError listing every problem if a work is invalid."""
    now = now or datetime.now(timezone.utc)
    problems: List[str] = []
    prepared: List[Dict[str, Any]] = []
    missing: List[str] = []
    for i, work in enumerate(works, 1):
        norm, errs, miss = validate_work(work)
        prefix = f"Work {i} (“{norm['title'] or '?'}”): " if len(works) > 1 else ""
        problems += [prefix + e for e in errs]
        missing += [prefix + m for m in miss]
        prepared.append(norm)
    if not prepared:
        problems.append("No work to register.")
    numbers = [w["submitter_work_number"] for w in prepared if w["submitter_work_number"]]
    if len(numbers) != len(set(numbers)):
        problems.append("Submitter work numbers must be unique.")
    if problems:
        raise ValueError("\n".join(problems))

    header, sender_ok = hdr(sender, now)
    if not sender_ok:
        missing.insert(0, "the sender ID (the IPI number the society issued to the submitting publisher): a society only accepts files from approved CWR participants")
    if not (sender.get("name") or "").strip():
        missing.insert(0, "the sender name, exactly as in the society's sender table")

    lines = [header, "GRH" + "NWR" + N(1, 5) + "02.10" + N(0, 10)]
    for t, w in enumerate(prepared):
        lines += work_records(w, t, w["submitter_work_number"] or f"HRL{t + 1:05d}")
    group_records = len(lines) - 1 + 1                     # everything after HDR, plus the GRT itself
    lines.append("GRT" + N(1, 5) + N(len(prepared), 8) + N(group_records, 8))
    lines.append("TRL" + N(1, 5) + N(len(prepared), 8) + N(len(lines) + 1, 8))

    submittable = not missing
    code = re.sub(r"[^A-Z0-9]", "", ascii_upper(sender_code))[:3].ljust(3, "0") if sender_code else "000"
    name = f"CW{now.strftime('%y')}{N(file_sequence, 4)}{code}_{re.sub(r'[^A-Z0-9]', '', ascii_upper(receiver_code))[:3].ljust(3, '0')}.V21"
    if not submittable:
        name = "DRAFT_" + name
    counts = {"works": len(prepared), "records": len(lines), "writers": sum(len(w["writers"]) for w in prepared), "publishers": sum(len(w["publishers"]) for w in prepared)}
    return Result("\r\n".join(lines) + "\r\n", name, submittable, missing, [], counts)


# ───────────────────────────── inputs ─────────────────────────────
def split_names(text: str) -> List[Tuple[str, str]]:
    """'Jane Doe & John Smith' -> [('DOE','JANE'), ('SMITH','JOHN')] (last name = the last word)."""
    out = []
    for part in re.split(r"\s*(?:,|;|&|\band\b|\bi\b|/)\s*", text or "", flags=re.I):
        part = part.strip()
        if not part:
            continue
        bits = part.split()
        out.append((bits[-1], " ".join(bits[:-1])))
    return out


def work_from_metadata(meta: Dict[str, Any]) -> Dict[str, Any]:
    """An analysis result, plus an optional ``cwr`` object ({writers, publishers, ...}), as a work.

    Without a ``cwr`` object only a sole writer can be inferred: they are given 100 % of every right (an unpublished work). Two or more
    names are never split 'equally' on our own authority: the shares come from the writers (a split sheet)."""
    cwr = meta.get("cwr") or {}
    work = {"title": meta.get("title"), "iswc": meta.get("iswc"), "duration_seconds": meta.get("duration"), "language": cwr.get("language") or "",
            "category": cwr.get("category") or "POP", "submitter_work_number": cwr.get("submitter_work_number"),
            "text_music_relationship": cwr.get("text_music_relationship") or ("MUS" if meta.get("hasVocals") is False else ""),
            "writers": cwr.get("writers"), "publishers": cwr.get("publishers"), "recorded": True}
    if not work["writers"]:
        names = split_names(str(meta.get("composer") or meta.get("artist") or ""))
        if len(names) == 1:
            last, first = names[0]
            work["writers"] = [{"last_name": last, "first_name": first, "designation": "CA", "pr_share": 100, "mr_share": 100, "sr_share": 100}]
        elif len(names) > 1:
            raise ValueError("Several writers are named, but their shares are not: add them (for example from a split sheet) before exporting.")
    return work


def work_from_split_sheet(doc: Dict[str, Any], title_override: Optional[str] = None) -> Dict[str, Any]:
    """A signed split sheet (or its payload) as a work. The composition shares become performing-right ownership shares.

    Mechanical and synchronisation shares follow the convention of a published work: when there are publishers they hold the whole of MR
    and SR (in proportion to their composition shares) and the writers hold none; with no publisher the writers hold them as they hold PR."""
    p = doc.get("payload", doc)
    contributors = p.get("contributors") or []
    work_in = p.get("work") or {}
    writers, publishers = [], []
    for c in contributors:
        role = c.get("role")
        if role == "arranger":
            raise ValueError("The split sheet lists an arranger; arrangements need a MOD registration, which is not supported yet.")
        if role == "publisher":
            publishers.append({"name": c.get("name"), "ipi_name": c.get("ipi"), "society": None, "pr_share": c.get("composition_share") or 0, "type": "E"})
        elif role in ("composer", "lyricist", "composer_lyricist"):
            bits = (c.get("name") or "").split()
            writers.append({"last_name": bits[-1] if bits else "", "first_name": " ".join(bits[:-1]), "ipi_name": c.get("ipi"),
                            "designation": {"composer": "C", "lyricist": "A", "composer_lyricist": "CA"}[role], "pr_share": c.get("composition_share") or 0})
    pub_total = sum(Decimal(str(x["pr_share"])) for x in publishers)
    wr_total = sum(Decimal(str(x["pr_share"])) for x in writers)
    if publishers and pub_total:
        left = Decimal(100)
        for i, x in enumerate(publishers):
            part = (Decimal(str(x["pr_share"])) * 100 / pub_total).quantize(Decimal("0.01")) if i < len(publishers) - 1 else left
            x["mr_share"] = x["sr_share"] = float(part)
            left -= part
    else:
        for x in publishers:
            x["mr_share"] = x["sr_share"] = 0
    for x in writers:
        x["mr_share"] = x["sr_share"] = 0 if publishers else x["pr_share"]
    if publishers and not writers:
        raise ValueError("The split sheet has publishers but no songwriters.")
    text_music = "MTX" if any(c.get("role") in ("lyricist", "composer_lyricist") for c in contributors) else "MUS"
    return {"title": title_override or work_in.get("title"), "iswc": work_in.get("iswc"), "text_music_relationship": text_music,
            "writers": writers, "publishers": publishers, "recorded": True, "composition_total": float(wr_total + pub_total)}


# ───────────────────────────── configuration and the one entry point the routes use ─────────────────────────────
def sender_from_env() -> Tuple[Dict[str, Any], str, str]:
    """The submitting publisher, as the society registered it: CWR_SENDER_TYPE (PB), CWR_SENDER_ID (the IPI number the society issued),
    CWR_SENDER_NAME (exactly as in the society's sender table), CWR_SENDER_CODE (3 characters, for the file name) and CWR_RECEIVER_CODE."""
    import os
    return ({"type": os.getenv("CWR_SENDER_TYPE", "PB"), "id": os.getenv("CWR_SENDER_ID", ""), "name": os.getenv("CWR_SENDER_NAME", "")},
            os.getenv("CWR_SENDER_CODE", ""), os.getenv("CWR_RECEIVER_CODE", "000"))


def export_metadata(meta: Dict[str, Any], splitsheet: Optional[Dict[str, Any]] = None, file_sequence: int = 1) -> Result:
    """An analysis result (and optionally a signed split sheet) as a CWR 2.1 file. Raises ValueError with every problem if it cannot be built."""
    sender, sender_code, receiver = sender_from_env()
    if splitsheet:
        work = work_from_split_sheet(splitsheet, title_override=meta.get("title"))
        work["duration_seconds"] = meta.get("duration")
        work["iswc"] = work.get("iswc") or meta.get("iswc")
        work["submitter_work_number"] = (meta.get("cwr") or {}).get("submitter_work_number")
    else:
        work = work_from_metadata(meta)
    if not work.get("submitter_work_number"):
        key = str(meta.get("sha256") or "")
        work["submitter_work_number"] = "HRL" + (key[:11] if key else re.sub(r"[^A-Za-z0-9]", "", str(meta.get("title") or "WORK"))[:11])
    res = build_file(sender, [work], file_sequence=file_sequence, receiver_code=receiver, sender_code=sender_code)
    res.notes.append("Shares come from the split sheet." if splitsheet else "Shares were inferred from a single named writer (100 % of every right); confirm them.")
    return res


def response_headers(res: Result) -> Dict[str, str]:
    """HTTP headers that say, next to the file itself, whether it can be sent and what is missing (ASCII, one line)."""
    missing = "; ".join(res.missing)[:600].encode("ascii", "ignore").decode()
    return {"Content-Disposition": f'attachment; filename="{res.filename}"', "X-CWR-Submittable": "true" if res.submittable else "false",
            "X-CWR-Missing": missing or "-", "Access-Control-Expose-Headers": "X-CWR-Submittable, X-CWR-Missing, Content-Disposition"}
