# CWR 2.1 export

`POST /api/cwr/export` and `GET /api/export/cwr/{job_id}` produce a CWR 2.1 **new work registration** (NWR): the file a publisher sends to a
collecting society to register a work. The record layouts follow the CISAC functional specification, and every record is also accepted by an
independent open-source grammar (`scripts/validate_cwr_with_cwrapi.py`, run in CI).

## What a society needs before it accepts a file

A society takes CWR only from an **approved CWR participant**. These cannot be invented by us, so until they are supplied the file is a **DRAFT**:
the file name starts with `DRAFT_`, the response carries `X-CWR-Submittable: false` and `X-CWR-Missing: ...` listing what is missing, and the
header holds placeholder zeros instead of a made-up sender ID.

| Needed | Where it comes from | Set it |
|---|---|---|
| Sender ID: the IPI number the society issued to the submitting publisher | the society's CWR sender table | env `CWR_SENDER_ID` |
| Sender name, exactly as in that table | same | env `CWR_SENDER_NAME` |
| 3-character sender code for the file name, receiver code | the society | env `CWR_SENDER_CODE`, `CWR_RECEIVER_CODE` |
| IPI name number and society code of every writer and of the publisher | the writers / the publisher | `cwr.writers[].ipi_name`, `.society`; `cwr.publishers[]` |

`CWR_SENDER_TYPE` defaults to `PB` (publisher). Acceptance by a society is not verified by us.

## Writers, publishers and shares

Send the analysis metadata plus either a signed split sheet (`/api/intelligence/splitsheet`) as `splitsheet`, or a `cwr` object:

```json
{"title": "Midnight Drive", "duration": 245,
 "cwr": {"submitter_work_number": "HRL00001", "language": "EN", "category": "POP",
         "writers": [{"last_name": "Skomra", "first_name": "Kamil", "designation": "CA", "ipi_name": "123456789", "society": "052",
                      "pr_share": 30, "publisher_ref": "P1"}],
         "publishers": [{"id": "P1", "name": "Example Publishing", "type": "E", "ipi_name": "55555555555", "society": "052",
                         "pr_share": 70, "mr_share": 100, "sr_share": 100}]}}
```

Shares are percentages of the whole work, per right (PR performing, MR mechanical, SR synchronisation). The file is refused (422, every problem
listed) unless the specification's own rules hold:

* each right adds up to 100 % (tolerance 0.06 %) across writers and publishers;
* writers hold at least 50 % of the performing right, publishers at most 50 %;
* at least one writer is a composer or author (`CA`, `C`, `A`); an original work cannot have an arranger;
* with several publishers every writer must say which one represents them (`publisher_ref`).

From a split sheet the composition shares become performing-right ownership; publishers hold the whole of MR and SR (in proportion to their
composition shares) and writers none. With no publisher the writers hold every right as they hold PR.

Without a split sheet or a `cwr` object, a **single** named writer (from `composer` or `artist`) is given 100 % of every right, which is only right
for an unpublished work by one writer; two or more names are never split on our own authority (422).

## Not supported yet

Revisions (`REV`), arrangements (`MOD`), alternate titles, performing artists, recordings, other writers/publishers (`OWR`, `OPU`), several
territories (world only), non-ASCII character sets (text is transliterated to ASCII capitals, so `Zażółć` becomes `ZAZOLC`).

## Checking a file yourself

```
pip install CWR-API pyyaml
python backend/scripts/validate_cwr_with_cwrapi.py file.V21
```
