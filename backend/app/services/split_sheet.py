"""Split sheet: who wrote and owns what, in shares that must add up, as a signed document and a printable PDF.

Two separate pies, because they are separate rights: the COMPOSITION (music and lyrics; songwriters and their publishers) and the
MASTER (the recording; producer, performer, label). Each pie must total 100 %. The sheet is signed with the engine's passport key so a
later change to any name or share is detectable, and the PDF has a signature line for every contributor: the sheet records what the
parties say they agreed, it is not a contract and not legal advice.
"""
from __future__ import annotations

import base64
import hashlib
import html
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from app.services import passport

ROLES = ("composer", "lyricist", "composer_lyricist", "arranger", "publisher", "producer", "performer", "label", "other")
COMPOSITION_ROLES = {"composer", "lyricist", "composer_lyricist", "arranger", "publisher"}
MAX_CONTRIBUTORS = 30
TOLERANCE = 0.005


def _num(v: Any) -> Optional[float]:
    if v in (None, ""):
        return None
    try:
        x = float(str(v).replace(",", "."))
    except ValueError:
        raise ValueError(f"“{v}” is not a number")
    if x < 0 or x > 100:
        raise ValueError("a share must be between 0 and 100")
    return round(x, 2)


def valid_iswc(code: str) -> bool:
    return bool(re.fullmatch(r"T-?\d{3}\.?\d{3}\.?\d{3}-?\d", (code or "").strip().upper()))


def validate(data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """Returns (clean input, error messages). Nothing is raised: the caller shows all the problems at once."""
    errors: List[str] = []
    work_in = data.get("work") or {}
    title = str(work_in.get("title") or "").strip()
    if not title:
        errors.append("The work needs a title.")
    isrc = str(work_in.get("isrc") or "").strip()
    if isrc and not re.fullmatch(r"[A-Za-z]{2}[A-Za-z0-9]{3}\d{7}", isrc.replace("-", "")):
        errors.append(f"ISRC “{isrc}” is not valid (CC-XXX-YY-NNNNN).")
    iswc = str(work_in.get("iswc") or "").strip()
    if iswc and not valid_iswc(iswc):
        errors.append(f"ISWC “{iswc}” is not valid (T-123.456.789-C).")
    date = str(work_in.get("date") or "").strip() or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        errors.append("The date must look like 2026-10-30.")
    work = {"title": title, "artist": str(work_in.get("artist") or "").strip(), "isrc": isrc.upper(), "iswc": iswc.upper(),
            "date": date, "notes": str(work_in.get("notes") or "").strip()[:1000]}

    raw = data.get("contributors") or []
    if not isinstance(raw, list) or not raw:
        errors.append("Add at least one contributor.")
        raw = []
    if len(raw) > MAX_CONTRIBUTORS:
        errors.append(f"At most {MAX_CONTRIBUTORS} contributors.")
        raw = raw[:MAX_CONTRIBUTORS]
    people: List[Dict[str, Any]] = []
    seen = set()
    for i, c in enumerate(raw, 1):
        name = str(c.get("name") or "").strip()[:120]
        role = str(c.get("role") or "").strip().lower()
        if not name:
            errors.append(f"Contributor {i} has no name.")
        elif (name.lower(), role) in seen:
            errors.append(f"“{name}” is listed twice as {role}; merge the shares into one row.")
        seen.add((name.lower(), role))
        if role not in ROLES:
            errors.append(f"“{name or i}”: role must be one of {', '.join(ROLES)}.")
        try:
            comp, mast = _num(c.get("composition_share")), _num(c.get("master_share"))
        except ValueError as e:
            errors.append(f"“{name or i}”: {e}.")
            comp = mast = None
        if comp is not None and role not in COMPOSITION_ROLES:
            errors.append(f"“{name or i}” is a {role}: a composition share belongs to songwriters, arrangers and publishers.")
        ipi = re.sub(r"\D", "", str(c.get("ipi") or ""))
        if ipi and not (9 <= len(ipi) <= 11):
            errors.append(f"“{name or i}”: an IPI number has 9 to 11 digits.")
        people.append({"name": name, "role": role, "composition_share": comp, "master_share": mast, "ipi": ipi,
                       "pro": str(c.get("pro") or "").strip()[:40], "email": str(c.get("email") or "").strip()[:160]})

    comp_total = round(sum(p["composition_share"] or 0 for p in people), 2)
    mast_total = round(sum(p["master_share"] or 0 for p in people), 2)
    if people and not any(p["composition_share"] for p in people):
        errors.append("Nobody has a composition share: the songwriters' shares must add up to 100.")
    elif abs(comp_total - 100) > TOLERANCE:
        errors.append(f"Composition shares add up to {comp_total}, not 100.")
    if any(p["master_share"] for p in people) and abs(mast_total - 100) > TOLERANCE:
        errors.append(f"Master (recording) shares add up to {mast_total}, not 100.")
    clean = {"work": work, "contributors": people, "totals": {"composition": comp_total, "master": mast_total}}
    return clean, errors


def build_document(clean: Dict[str, Any], prepared_by: str = "") -> Dict[str, Any]:
    payload = {"type": "split-sheet", "v": 1, "id": str(uuid.uuid4()), "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "preparedBy": hashlib.sha256(prepared_by.encode()).hexdigest()[:12] if prepared_by else None, **clean}
    sig = passport._get_key().sign(passport.canonical(payload))
    return {"alg": "Ed25519", "keyId": passport.key_id(), "payload": payload, "signature": base64.b64encode(sig).decode()}


def verify_document(doc: Dict[str, Any], public_key: Optional[str] = None) -> Dict[str, Any]:
    try:
        pub_b64 = public_key or passport.public_key_b64()
        pub = Ed25519PublicKey.from_public_bytes(base64.b64decode(pub_b64))
        if doc.get("alg") != "Ed25519" or (doc.get("payload") or {}).get("type") != "split-sheet":
            return {"valid": False, "reason": "not a split sheet"}
        pub.verify(base64.b64decode(doc["signature"]), passport.canonical(doc["payload"]))
        p = doc["payload"]
        _, errors = validate({"work": p.get("work"), "contributors": p.get("contributors")})
        return {"valid": True, "id": p.get("id"), "createdAt": p.get("createdAt"), "keyId": passport.key_id(pub_b64), "sharesAddUp": not errors,
                "problems": errors}
    except (InvalidSignature, KeyError, ValueError, TypeError):
        return {"valid": False, "reason": "signature does not match the document"}


def _pct(v: Optional[float]) -> str:
    return "" if v is None else f"{v:g} %"


def render_html(doc: Dict[str, Any]) -> str:
    p = doc["payload"]
    w, rows = p["work"], p["contributors"]
    e = html.escape
    body = "".join(
        f"<tr><td>{e(c['name'])}</td><td>{e(c['role'].replace('_', ' / '))}</td><td class=n>{_pct(c['composition_share'])}</td><td class=n>{_pct(c['master_share'])}</td>"
        f"<td>{e(c['ipi'])}{' · ' if c['ipi'] and c['pro'] else ''}{e(c['pro'])}</td></tr>" for c in rows)
    sign = "".join(f"<div class=sig><div class=line></div>{e(c['name'])} <span>date</span></div>" for c in rows)
    meta = " · ".join(x for x in (f"Artist: {e(w['artist'])}" if w["artist"] else "", f"ISRC {e(w['isrc'])}" if w["isrc"] else "", f"ISWC {e(w['iswc'])}" if w["iswc"] else "", f"Date {e(w['date'])}") if x)
    digest = hashlib.sha256(passport.canonical(p)).hexdigest()
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 18mm }} body {{ font: 10.5pt/1.4 Helvetica, Arial, sans-serif; color: #111 }}
h1 {{ font-size: 18pt; margin: 0 0 2mm }} .meta {{ color: #444; margin-bottom: 6mm }}
table {{ width: 100%; border-collapse: collapse; margin: 4mm 0 }} th, td {{ border-bottom: 1px solid #bbb; padding: 2mm 1.5mm; text-align: left; vertical-align: top }}
th {{ font-size: 9pt; text-transform: uppercase; color: #555 }} .n {{ text-align: right; white-space: nowrap }} tfoot td {{ font-weight: bold; border-top: 2px solid #111 }}
.sig {{ margin-top: 11mm; width: 48%; display: inline-block; vertical-align: top }} .line {{ border-bottom: 1px solid #111; height: 9mm }} .sig span {{ color: #777; float: right }}
.note {{ margin-top: 10mm; font-size: 8.5pt; color: #555 }} .id {{ font: 7.5pt monospace; color: #666; margin-top: 3mm; word-break: break-all }}
</style></head><body>
<h1>Split sheet: {e(w['title'])}</h1><div class="meta">{meta}</div>
<table><thead><tr><th>Name</th><th>Role</th><th class=n>Composition</th><th class=n>Master</th><th>IPI / society</th></tr></thead><tbody>{body}</tbody>
<tfoot><tr><td colspan=2>Total</td><td class=n>{p['totals']['composition']:g} %</td><td class=n>{p['totals']['master']:g} %</td><td></td></tr></tfoot></table>
{f'<p>{e(w["notes"])}</p>' if w['notes'] else ''}
<div>{sign}</div>
<p class="note">This sheet records what the parties state they have agreed about ownership of the composition (music and lyrics) and of the master recording. It is not a contract and not legal advice; each contributor confirms it by signing. The document is signed electronically by HardbanRecords Metadata Engine so that later changes can be detected.</p>
<div class="id">Document {e(p['id'])} · created {e(p['createdAt'])} · key {e(doc['keyId'])} · SHA-256 {digest}</div>
</body></html>"""


def render_pdf(doc: Dict[str, Any]) -> bytes:
    from weasyprint import HTML
    return HTML(string=render_html(doc)).write_pdf()
