# Webhooks

Metadata Engine can call your server when an analysis finishes, so a pipeline does not have to poll `GET /api/analysis/job/{id}`.
One webhook per account. Manage it with your login token (`Authorization: Bearer ...`) or your API key (`X-API-Key: ...`).

| Call | What it does |
|---|---|
| `PUT /api/webhook-endpoint` `{"url": "https://..."}` | Create or change the URL. The response contains `secret` **once**, when the webhook is created. Keep it. |
| `GET /api/webhook-endpoint` | URL, whether it is active, the last delivery's status and error. Never returns the secret. |
| `POST /api/webhook-endpoint/rotate-secret` | New secret (returned once). The old one stops working at once. |
| `POST /api/webhook-endpoint/test` | Sends one `webhook.test` event now and tells you whether your server accepted it. |
| `DELETE /api/webhook-endpoint` | Remove it. |

## Rules for the URL

* `https://` only, no user name or password inside the URL.
* The host must resolve to public addresses only. Anything that resolves to a private, loopback, link-local or otherwise internal address is refused.
* Redirects are not followed.

## Events

| `type` | When | `data` |
|---|---|---|
| `analysis.completed` | the analysis finished | `job_id`, `file_name`, `status`, `summary` (title, artist, bpm, key, mainGenre, hasVocals, trustGrade, needsReview, syncReadinessScore, sha256), `result_url` |
| `analysis.failed` | the analysis failed | `job_id`, `file_name`, `status`, `error` |
| `webhook.test` | you pressed test | a message |

The event carries a summary, not the full result: fetch the rest from `result_url` with your token or API key.

```json
{"id": "evt_4f0c...", "type": "analysis.completed", "created": 1793400000,
 "data": {"job_id": "3ae3dbea-...", "file_name": "song.wav", "status": "completed",
          "summary": {"title": "...", "bpm": 123.9, "key": "A", "trustGrade": "A", "...": "..."},
          "result_url": "https://metadata.hardbanrecordslab.online/api/analysis/job/3ae3dbea-..."}}
```

## Delivery

Answer with any `2xx` within 10 seconds. Anything else is retried (after 2 s, 10 s and 60 s; the same `X-HRL-Delivery` id every time, so
you can ignore duplicates). A `4xx` other than 408, 425 and 429 is treated as a final rejection and not retried. After 20 failed
deliveries in a row the webhook is switched off (`GET` shows why); setting the URL again switches it back on.

## Verify the signature

Every request carries

```
X-HRL-Event: analysis.completed
X-HRL-Delivery: evt_4f0c...
X-HRL-Signature: t=1793400000,v1=<hex>
```

`v1` is the hex HMAC-SHA256, keyed with your secret, of the string `"<t>." + <raw request body>`. Check it against the **raw** bytes (before any
JSON parsing), compare in constant time, and reject a `t` that is more than 5 minutes old.

```python
import hashlib, hmac, time

def verify(secret: str, raw_body: bytes, header: str, tolerance=300) -> bool:
    fields = dict(p.split("=", 1) for p in header.split(","))
    if abs(time.time() - int(fields["t"])) > tolerance:
        return False
    expected = hmac.new(secret.encode(), fields["t"].encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, fields["v1"])
```

```js
const crypto = require('crypto');
function verify(secret, rawBody, header, tolerance = 300) {
  const f = Object.fromEntries(header.split(',').map(p => p.split('=', 2)));
  if (Math.abs(Date.now() / 1000 - Number(f.t)) > tolerance) return false;
  const mac = crypto.createHmac('sha256', secret).update(`${f.t}.`).update(rawBody).digest('hex');
  return mac.length === f.v1.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(f.v1));
}
```
