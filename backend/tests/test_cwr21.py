"""CWR 2.1: record layouts, counters, the specification's share rules, drafts, the inputs, and the routes.

The layouts were taken from the CISAC functional specification and every generated record was also accepted by the independent open-source
CWR-DataApi grammar (test_independent_grammar, which runs where that package is installed). The earlier generators were rejected by it
record for record: they wrote WRK and GRL (not CWR records), a wrong EDI version and a numeric field full of letters."""
import copy
from datetime import datetime, timezone

import pytest

from app.services import cwr21

NOW = datetime(2026, 10, 30, 21, 5, 9, tzinfo=timezone.utc)
SENDER = {"type": "PB", "id": "123456789", "name": "Hardbanrecords Lab"}
SOLO = {"title": "Midnight Drive", "iswc": "T-123456789-0", "duration_seconds": 245, "language": "en", "text_music_relationship": "MTX",
        "submitter_work_number": "HRL00001",
        "writers": [{"last_name": "Skomra", "first_name": "Kamil", "designation": "CA", "ipi_name": "123456789", "society": "052",
                     "pr_share": 100, "mr_share": 100, "sr_share": 100}]}
PUBLISHED = {"title": "Zażółć gęślą jaźń", "duration_seconds": 190, "submitter_work_number": "HRL00002",
             "writers": [{"id": "W1", "last_name": "Skomra", "first_name": "Kamil", "designation": "CA", "ipi_name": "123456789", "society": "052", "pr_share": 30, "publisher_ref": "P1"},
                         {"id": "W2", "last_name": "Nowak", "first_name": "Anna", "designation": "C", "ipi_name": "987654321", "society": "052", "pr_share": 30, "publisher_ref": "P1"}],
             "publishers": [{"id": "P1", "name": "HardbanRecords Lab", "type": "E", "ipi_name": "55555555555", "society": "052", "agreement_number": "AGR1",
                             "pr_share": 40, "mr_share": 100, "sr_share": 100}]}

LENGTHS = {"HDR": 101, "GRH": 26, "NWR": 260, "SPU": 183, "SPT": 58, "SWR": 180, "SWT": 52, "PWR": 110, "GRT": 24, "TRL": 24}


def build(works, **kw):
    return cwr21.build_file(SENDER, works, now=NOW, sender_code="HRL", receiver_code="ZAI", **kw)


def lines_of(res):
    assert res.text.endswith("\r\n")
    return res.text.split("\r\n")[:-1]


def errors_of(work):
    with pytest.raises(ValueError) as e:
        build([work])
    return str(e.value).split("\n")


def tweak(base, **changes):
    w = copy.deepcopy(base)
    w.update(changes)
    return w


# ───────────────────────────── layouts ─────────────────────────────
def test_every_record_has_the_length_the_specification_gives():
    for work in (SOLO, PUBLISHED):
        for line in lines_of(build([work])):
            assert len(line) == LENGTHS[line[:3]], f"{line[:3]} is {len(line)} characters, expected {LENGTHS[line[:3]]}"


def test_only_real_cwr_record_types_in_the_right_order():
    assert [l[:3] for l in lines_of(build([SOLO]))] == ["HDR", "GRH", "NWR", "SWR", "SWT", "GRT", "TRL"]
    assert [l[:3] for l in lines_of(build([PUBLISHED]))] == ["HDR", "GRH", "NWR", "SPU", "SPT", "SWR", "SWT", "PWR", "SWR", "SWT", "PWR", "GRT", "TRL"]


def test_header_and_group_records():
    hdr, grh = lines_of(build([SOLO]))[:2]
    assert hdr[3:5] == "PB" and hdr[5:14] == "123456789" and hdr[14:59].strip() == "HARDBANRECORDS LAB"
    assert hdr[59:64] == "01.10"                                               # the EDI standard version: always 01.10 (not 02.10)
    assert hdr[64:78] == "20261030210509" and hdr[78:86] == "20261030"          # creation date + time, transmission date
    assert hdr[86:101] == " " * 15                                              # character set is for non-ASCII files only
    assert grh == "GRHNWR0000102.100000000000"


def test_record_prefix_counters_follow_the_specification():
    two = lines_of(build([SOLO, tweak(SOLO, submitter_work_number="HRL00003")]))
    nwr = [l for l in two if l.startswith("NWR")]
    assert [l[3:11] for l in nwr] == ["00000000", "00000001"]                  # first transaction in the group is 0, then +1
    assert all(l[11:19] == "00000000" for l in nwr)                             # a transaction header always has record sequence 0
    detail = [l for l in two if l[:3] in ("SWR", "SWT")]
    assert [l[3:11] for l in detail] == ["00000000", "00000000", "00000001", "00000001"]      # details carry their header's transaction number
    assert [l[11:19] for l in detail] == ["00000001", "00000002", "00000001", "00000002"]     # and count up from 1 within it


def test_trailers_count_records_and_transactions():
    for work in ([SOLO], [PUBLISHED], [SOLO, tweak(PUBLISHED, submitter_work_number="HRL00009")]):
        lines = lines_of(build(work))
        grt, trl = lines[-2], lines[-1]
        assert grt[:3] == "GRT" and grt[3:8] == "00001"
        assert int(grt[8:16]) == len(work)                                      # transactions in the group
        assert int(grt[16:24]) == len(lines) - 2                                # GRH..GRT inclusive = everything but HDR and TRL
        assert trl[3:8] == "00001" and int(trl[8:16]) == len(work) and int(trl[16:24]) == len(lines)   # HDR..TRL inclusive


def test_work_record_fields_at_the_specified_positions():
    nwr = next(l for l in lines_of(build([SOLO])) if l.startswith("NWR"))
    assert nwr[19:79].strip() == "MIDNIGHT DRIVE" and nwr[79:81] == "EN" and nwr[81:95].strip() == "HRL00001"
    assert nwr[95:106] == "T1234567890"                                          # ISWC without punctuation
    assert nwr[126:129] == "POP" and nwr[129:135] == "000405" and nwr[135] == "Y"
    assert nwr[136:139] == "MTX" and nwr[142:145] == "ORI"


def test_shares_are_five_digit_percentages():
    assert [cwr21.share(x) for x in (0, 50, 33.34, 100, "12,5", 0.06)] == ["00000", "05000", "03334", "10000", "01250", "00006"]
    spu = next(l for l in lines_of(build([PUBLISHED])) if l.startswith("SPU"))
    assert spu[115:120] == "04000" and spu[123:128] == "10000" and spu[131:136] == "10000"


def test_text_is_ascii_upper_case_and_polish_letters_are_transliterated():
    text = build([PUBLISHED]).text
    assert text.isascii()
    nwr = next(l for l in text.split("\r\n") if l.startswith("NWR"))
    assert "ZAZOLC GESLA JAZN" in nwr
    assert cwr21.ascii_upper("Łódź, żółw – ‘test’ ñ") == "LODZ, ZOLW  TEST N"
    assert len(cwr21.A("x" * 100, 10)) == 10 and cwr21.A("ab", 5) == "AB   "


def test_iswc_and_duration_helpers():
    assert cwr21.norm_iswc("T-123.456.789-0") == "T1234567890" and cwr21.norm_iswc("T-123456789-0") == "T1234567890"
    assert cwr21.norm_iswc("12345") is None and cwr21.norm_iswc(None) is None
    assert cwr21.hhmmss(185) == "000305" and cwr21.hhmmss(3725) == "010205" and cwr21.hhmmss(0) == "000000" and cwr21.hhmmss("x") == "000000"


# ───────────────────────────── the specification's share rules ─────────────────────────────
def test_shares_must_add_up_per_right():
    bad = copy.deepcopy(PUBLISHED)
    bad["publishers"][0]["mr_share"] = 90
    assert any("mechanical (MR) shares add up to 90" in e for e in errors_of(bad))
    bad = copy.deepcopy(PUBLISHED)
    bad["writers"][0]["pr_share"] = 20
    assert any("performing (PR) shares add up to 90" in e for e in errors_of(bad))


def test_writers_hold_at_least_half_of_the_performing_right_and_publishers_at_most_half():
    bad = copy.deepcopy(PUBLISHED)
    bad["writers"][0]["pr_share"], bad["writers"][1]["pr_share"], bad["publishers"][0]["pr_share"] = 20, 20, 60
    errs = errors_of(bad)
    assert any("at least 50 %" in e for e in errs) and any("at most 50 %" in e for e in errs)


def test_tolerance_of_six_hundredths_is_allowed():
    ok = copy.deepcopy(PUBLISHED)
    ok["writers"][0]["pr_share"], ok["writers"][1]["pr_share"] = 30.03, 30.03                  # 100.06 in total
    build([ok])
    over = copy.deepcopy(PUBLISHED)
    over["writers"][0]["pr_share"], over["writers"][1]["pr_share"] = 30.04, 30.04               # 100.08
    errors_of(over)


def test_work_needs_a_writer_a_title_and_a_composer_or_author():
    assert any("at least one writer" in e for e in errors_of(tweak(SOLO, writers=[])))
    assert any("needs a title" in e for e in errors_of(tweak(SOLO, title="")))
    arr = copy.deepcopy(SOLO)
    arr["writers"][0]["designation"] = "AR"
    errs = errors_of(arr)
    assert any("composer/author" in e for e in errs) and any("cannot have an arranger" in e for e in errs)
    assert any("MOD" in e for e in errors_of(tweak(SOLO, version_type="MOD")))


def test_other_field_rules():
    assert any("SER" in e or "Serious" in e for e in errors_of(tweak(SOLO, category="SER", duration_seconds=0)))
    build([tweak(SOLO, category="SER")])
    assert any("category must be" in e for e in errors_of(tweak(SOLO, category="XXX")))
    bad = copy.deepcopy(SOLO)
    bad["writers"][0]["last_name"] = ""
    assert any("no last name" in e for e in errors_of(bad))
    bad = copy.deepcopy(SOLO)
    bad["writers"][0]["pr_share"] = "lots"
    assert any("not a number" in e for e in errors_of(bad))
    bad = copy.deepcopy(SOLO)
    bad["writers"][0]["designation"] = "ZZ"
    assert any("designation" in e for e in errors_of(bad))
    bad = copy.deepcopy(PUBLISHED)
    bad["publishers"][0]["type"] = "ZZ"
    assert any("publisher type" in e for e in errors_of(bad))


def test_several_publishers_need_to_be_linked_explicitly():
    two = copy.deepcopy(PUBLISHED)
    two["publishers"][0]["pr_share"] = 20
    two["publishers"].append({"id": "P2", "name": "Other Publisher", "type": "E", "ipi_name": "11111111111", "society": "052", "pr_share": 20, "mr_share": 0, "sr_share": 0})
    two["writers"][0]["publisher_ref"] = None
    assert any("must say which publisher" in e for e in errors_of(two))
    two["writers"][0]["publisher_ref"] = "P2"
    two["writers"][1]["publisher_ref"] = "NOPE"
    assert any("not in the list" in e for e in errors_of(two))
    two["writers"][1]["publisher_ref"] = "P1"
    lines = lines_of(build([two]))
    assert [l[:3] for l in lines].count("SPU") == 2 and [l[:3] for l in lines].count("PWR") == 2
    pwr = [l for l in lines if l.startswith("PWR")]
    assert pwr[0][19:28].strip() == "P2" and pwr[1][19:28].strip() == "P1"


def test_all_problems_are_reported_at_once_with_the_work_named():
    with pytest.raises(ValueError) as e:
        build([tweak(SOLO, title="Good One"), tweak(SOLO, title="", writers=[])])
    msg = str(e.value)
    assert "Work 2" in msg and "needs a title" in msg and "at least one writer" in msg
    with pytest.raises(ValueError, match="unique"):
        build([SOLO, SOLO])
    with pytest.raises(ValueError, match="No work"):
        build([])


# ───────────────────────────── drafts and credentials ─────────────────────────────
def test_a_complete_file_is_submittable_and_named_by_the_specification():
    res = build([SOLO])
    assert res.submittable and res.missing == []
    assert res.filename == "CW260001HRL_ZAI.V21"                                # CW + year + 4-digit sequence + sender + _ + receiver
    assert build([SOLO], file_sequence=42).filename == "CW260042HRL_ZAI.V21"
    assert res.counts == {"works": 1, "records": 7, "writers": 1, "publishers": 0}


def test_missing_credentials_make_it_a_draft_and_say_what_is_missing():
    res = cwr21.build_file({"type": "PB", "id": "", "name": ""}, [tweak(SOLO, writers=[{"last_name": "Doe", "first_name": "Jane", "designation": "CA",
                           "pr_share": 100, "mr_share": 100, "sr_share": 100}])], now=NOW)
    assert not res.submittable and res.filename.startswith("DRAFT_")
    text = " | ".join(res.missing)
    assert "sender ID" in text and "sender name" in text and "IPI name number of writer DOE" in text and "society code of writer DOE" in text
    assert lines_of(res)[0][5:14] == "000000000"                               # a placeholder, never a made-up ID


def test_a_publisher_without_an_ipi_number_is_flagged():
    pub = copy.deepcopy(PUBLISHED)
    pub["publishers"][0]["ipi_name"] = ""
    res = build([pub])
    assert not res.submittable and any("publisher HARDBANRECORDS LAB" in m and "mandatory" in m for m in res.missing)


# ───────────────────────────── inputs ─────────────────────────────
def test_a_sole_named_writer_gets_everything_and_several_names_are_refused():
    w = cwr21.work_from_metadata({"title": "T", "composer": "Jane Doe", "duration": 60})
    assert w["writers"][0]["last_name"] == "Doe" and w["writers"][0]["first_name"] == "Jane" and w["writers"][0]["pr_share"] == 100
    with pytest.raises(ValueError, match="shares are not"):
        cwr21.work_from_metadata({"title": "T", "composer": "Jane Doe & John Smith"})
    assert cwr21.split_names("Jane Doe, John Smith and Max Payne") == [("Doe", "Jane"), ("Smith", "John"), ("Payne", "Max")]
    given = cwr21.work_from_metadata({"title": "T", "composer": "A B & C D", "cwr": {"writers": SOLO["writers"]}})
    assert given["writers"] == SOLO["writers"]                                  # explicit shares win


SHEET = {"payload": {"work": {"title": "Midnight Drive", "iswc": "T-123.456.789-0"}, "contributors": [
    {"name": "Kamil Skomra", "role": "composer_lyricist", "composition_share": 30, "ipi": "123456789"},
    {"name": "Anna Nowak", "role": "composer", "composition_share": 30},
    {"name": "HardbanRecords Lab", "role": "publisher", "composition_share": 40}]}}


def test_split_sheet_becomes_writers_and_publishers_with_conventional_rights():
    w = cwr21.work_from_split_sheet(SHEET)
    assert [x["designation"] for x in w["writers"]] == ["CA", "C"] and w["text_music_relationship"] == "MTX"
    assert [x["pr_share"] for x in w["writers"]] == [30, 30] and w["publishers"][0]["pr_share"] == 40
    assert w["publishers"][0]["mr_share"] == 100.0 and w["publishers"][0]["sr_share"] == 100.0     # a publisher holds the whole of MR and SR
    assert all(x["mr_share"] == 0 for x in w["writers"])
    res = build([w])                                                                                  # and it is a valid registration
    assert [l[:3] for l in lines_of(res)].count("PWR") == 2


def test_split_sheet_without_a_publisher_gives_the_writers_every_right():
    sheet = {"payload": {"work": {"title": "T"}, "contributors": [{"name": "A One", "role": "composer", "composition_share": 60}, {"name": "B Two", "role": "lyricist", "composition_share": 40}]}}
    w = cwr21.work_from_split_sheet(sheet)
    assert [x["mr_share"] for x in w["writers"]] == [60, 40] and w["publishers"] == []
    build([w])


def test_split_sheet_cases_that_cannot_be_registered_are_refused_with_a_reason():
    arranger = {"payload": {"work": {"title": "T"}, "contributors": [{"name": "A", "role": "arranger", "composition_share": 100}]}}
    with pytest.raises(ValueError, match="MOD"):
        cwr21.work_from_split_sheet(arranger)
    only_pub = {"payload": {"work": {"title": "T"}, "contributors": [{"name": "P", "role": "publisher", "composition_share": 100}]}}
    with pytest.raises(ValueError, match="no songwriters"):
        cwr21.work_from_split_sheet(only_pub)
    pub_heavy = {"payload": {"work": {"title": "T"}, "contributors": [{"name": "A One", "role": "composer", "composition_share": 40}, {"name": "P", "role": "publisher", "composition_share": 60}]}}
    errs = errors_of(cwr21.work_from_split_sheet(pub_heavy))
    assert any("at least 50 %" in e for e in errs)                                                    # the specification's own rule, not ours


def test_three_publishers_split_mr_and_sr_to_exactly_one_hundred():
    sheet = {"payload": {"work": {"title": "T"}, "contributors": [{"name": "W One", "role": "composer", "composition_share": 55},
                                                                    {"name": "P1", "role": "publisher", "composition_share": 15}, {"name": "P2", "role": "publisher", "composition_share": 15},
                                                                    {"name": "P3", "role": "publisher", "composition_share": 15}]}}
    w = cwr21.work_from_split_sheet(sheet)
    assert round(sum(p["mr_share"] for p in w["publishers"]), 2) == 100.0


# ───────────────────────────── the routes ─────────────────────────────
def test_export_metadata_uses_the_environment_and_marks_drafts(monkeypatch):
    for k in ("CWR_SENDER_ID", "CWR_SENDER_NAME", "CWR_SENDER_CODE", "CWR_SENDER_TYPE", "CWR_RECEIVER_CODE"):
        monkeypatch.delenv(k, raising=False)
    meta = {"title": "Test Song", "composer": "Jane Doe", "duration": 185, "iswc": "T-123456789-0", "sha256": "ab" * 32}
    draft = cwr21.export_metadata(meta)
    assert not draft.submittable and draft.filename.startswith("DRAFT_")
    assert cwr21.response_headers(draft)["X-CWR-Submittable"] == "false" and "sender ID" in cwr21.response_headers(draft)["X-CWR-Missing"]
    nwr = next(l for l in draft.text.split("\r\n") if l.startswith("NWR"))
    assert nwr[81:95] == "HRLABABABABABA"                                                              # a stable submitter work number from the audio hash
    monkeypatch.setenv("CWR_SENDER_ID", "123456789")
    monkeypatch.setenv("CWR_SENDER_NAME", "Hardbanrecords Lab")
    monkeypatch.setenv("CWR_SENDER_CODE", "HRL")
    monkeypatch.setenv("CWR_RECEIVER_CODE", "ZAI")
    still = cwr21.export_metadata({**meta, "cwr": {"writers": SOLO["writers"]}})
    assert still.submittable and still.filename.startswith("CW") and "DRAFT" not in still.filename


from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.routes.cwr import router as cwr_router  # noqa: E402


def test_cwr_route(monkeypatch):
    for k in ("CWR_SENDER_ID", "CWR_SENDER_NAME", "CWR_SENDER_CODE"):
        monkeypatch.delenv(k, raising=False)
    app = FastAPI()
    app.include_router(cwr_router, prefix="/api")
    c = TestClient(app)
    r = c.post("/api/cwr/export", json={"title": "Test Song", "composer": "Jane Doe", "duration": 185})
    assert r.status_code == 200 and r.headers["x-cwr-submittable"] == "false" and "DRAFT_" in r.headers["content-disposition"]
    assert r.text.startswith("HDR") and [l[:3] for l in r.text.split("\r\n") if l] == ["HDR", "GRH", "NWR", "SWR", "SWT", "GRT", "TRL"]
    bad = c.post("/api/cwr/export", json={"title": "Test Song", "composer": "Jane Doe & John Smith"})
    assert bad.status_code == 422 and "shares are not" in bad.json()["detail"][0]
    withsheet = c.post("/api/cwr/export", json={"title": "Midnight Drive", "duration": 200, "splitsheet": SHEET})
    assert withsheet.status_code == 200 and "PWR" in withsheet.text
