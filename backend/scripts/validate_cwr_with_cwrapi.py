"""Check a CWR 2.1 file against an INDEPENDENT implementation: the open-source CWR-DataApi grammar (pip install CWR-API).

Usage: python scripts/validate_cwr_with_cwrapi.py file.V21 [more files]

Every record is parsed with the library's record grammar (field order, widths, lookup tables). The library's object decoders have naming
bugs with some of its own records, so its parse actions are stripped and only the grammar is used. Exit code 1 when a record is rejected.
This checks the FORMAT; whether a society accepts the content (sender ID, IPI numbers, agreements) is up to the society."""
import sys

import yaml

_load = yaml.load
yaml.load = lambda s, Loader=yaml.FullLoader, **kw: _load(s, Loader=Loader, **kw)          # CWR-API predates PyYAML 6

from cwr.parser.decoder.file import default_grammar_factory  # noqa: E402

RULES = {"HDR": "transmission_header", "GRH": "group_header", "NWR": "work", "SPU": "publisher", "SPT": "publisher_territory", "SWR": "writer",
         "SWT": "writer_territory", "PWR": "writer_publisher", "GRT": "group_trailer", "TRL": "transmission_trailer"}


def _strip(e, seen=None):
    seen = set() if seen is None else seen
    if id(e) in seen:
        return
    seen.add(id(e))
    try:
        e.parseAction = []
    except Exception:  # noqa: BLE001
        pass
    for c in getattr(e, "exprs", []) or []:
        _strip(c, seen)
    inner = getattr(e, "expr", None)
    if inner is not None:
        _strip(inner, seen)


def check_records(text: str):
    """Returns (records accepted, [(line number, record type, reason)])."""
    factory = default_grammar_factory()
    bad, accepted = [], 0
    for n, line in enumerate(text.split("\r\n"), 1):
        if not line:
            continue
        rule = RULES.get(line[:3])
        if not rule:
            bad.append((n, line[:3], "not a CWR record type"))
            continue
        r = factory.get_rule(rule)
        _strip(r)
        try:
            r.parse_string(line, parse_all=True)
            accepted += 1
        except Exception as e:  # noqa: BLE001
            bad.append((n, line[:3], str(e)[:160]))
    return accepted, bad


if __name__ == "__main__":
    failed = False
    for path in sys.argv[1:]:
        accepted, bad = check_records(open(path, encoding="ascii", newline="").read())
        print(f"{path}: {accepted} records accepted, {len(bad)} rejected")
        for n, rt, why in bad:
            print(f"  line {n} {rt}: {why}")
        failed = failed or bool(bad)
    sys.exit(1 if failed else 0)
