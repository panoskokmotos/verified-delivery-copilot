# API

## `POST /api/v1/verify`

Checks one delivery photo against the products that were donated. Server to server, for platforms that
already run a donation flow (for example Givelink). Stateless: nothing is stored on this side.

**Auth:** `Authorization: Bearer <key>`. Keys come from `VDC_API_KEYS` (comma-separated). With no keys set the
endpoint answers `503`.

**Body:** `multipart/form-data`

| Field | Required | What |
|---|---|---|
| `photo` | yes | JPG, PNG or WEBP, as uploaded by the nonprofit (keep the original bytes: AI content labels live in them) |
| `items` | yes | JSON array, 1 to 50: `[{"name":"Dry dog food, 30 lb bag","quantity":4,"unit":"bags","image":"https://..."}]`. `image` (optional) is the catalog photo, shown to donors next to the delivery photo. |
| `knownHashes` | no | JSON array of earlier photos, `[{"hash":"4b2b86969899387c","id":"delivery-123"}]`. Send your history to catch a reused photo. |
| `deliveryId` | no | Your id. A match against the same id counts as a retake, not reuse. |
| `orgName`, `city`, `context` | no | Helps the checklist and the thank-you draft. |
| `orderCode` | no | The supplier order. If a packing slip in the photo shows a different order, that counts against the photo. |
| `orgLat`, `orgLon` | no | The nonprofit's address. With it, GPS in the photo and the upload location become a distance. |
| `uploadLat`, `uploadLon` | no | Where the phone was at capture, if the nonprofit shared it. Returned only as a distance, for your admin. Don't publish it. |

**Response 200:**

```json
{
  "verdict": "review",
  "genuine": true,
  "complete": false,
  "score": 68,
  "reasons": ["Toilet paper is fully visible.", "Only 1 of 2 paper towel packs can be seen."],
  "nextAction": "Retake the photo with both paper towel packs in view.",
  "items": [
    { "name": "Paper towels", "expected": 2, "seen": 1, "status": "partial", "where": "front left, on table", "note": "One pack visible." }
  ],
  "checks": { "aiContentLabel": null, "reusedPhotoOf": null, "visualAiSigns": "none", "cameraTimestamp": null, "photoDistanceKm": null, "uploadDistanceKm": 0.3 },
  "notes": [],
  "photoHash": "7373e0e0e8ccf349",
  "thankYouDraft": "Thank you. ...",
  "models": { "vision": "google/gemma-3-27b-it", "reasoning": "nvidia/nemotron-3-super-120b-a12b", "writer": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B" }
}
```

`verdict`:
- `approve`: genuine and every product visible.
- `review`: genuine, but some products are missing or hard to count. Tell the nonprofit what's missing. They may retake or share it as partial proof.
- `reject`: not genuine (AI content label, reused photo, strong visual signs of AI) or shows none of the products.

Store `photoHash` with the delivery and send it back in `knownHashes` next time.

Model calls count against `NEBIUS_MAX_CALLS_PER_DAY` (3 or 4 per call). Allow up to 60 seconds per request.

## Open data

- `GET /api/receipts/{id}`: the receipt of a shared proof, format `delivery-receipt/v1` (see `receipt.schema.json`). No donor names.
- `GET /api/stats`: totals and a breakdown by cause, as JSON. Add `?format=csv` for one row per delivery.
