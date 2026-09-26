# Verified Delivery Copilot

Hackathon entry: Nebius x NVIDIA Global AI Hackathon, track "Best Apps and Agents".
Deadline: Fri Oct 30, 2026, 10:00 AM PT. Submit by Oct 28.

## What it does
Agent that checks a nonprofit's delivery photo against the original request.
Pipeline in `lib/pipeline.ts`: intake (Nemotron Super), vision (Gemma 3, MiniCPM fallback), integrity (AI label, reuse, location distance), decision (Super, Ultra when borderline), thank-you draft (Nemotron Nano). The nonprofit is already verified by the platform, so no org lookup.

## Hard rules (the hackathon checks these)
- Every model call goes through Nebius Token Factory (`lib/nebius.ts`). No other LLM provider.
- At least one NVIDIA Nemotron model is used at runtime. Model IDs come from env vars only.
- Never commit secrets. Keys live in `.env.local` only.
- Repo stays public and MIT.

## Product rules
- The LLM reviewer can only make a verdict stricter, never looser. Keep this in `decide()`.
- No donor message before approval.
- Reject only a photo that is not genuine (reused, AI-labeled, strong visual signs of AI) or shows none of the gift. A genuine photo missing some items is "review": the nonprofit is told what is missing and may still send it; the receipt says which items are visible.
- Missing or old camera data is not a penalty. Nonprofits upload from shared folders and WhatsApp.

## Commands
- `npm run dev` : local app on :3000
- `npm run build` : must pass before every commit. While `npm run dev` runs, check with `NEXT_DIST_DIR=.next-check npm run build` so the dev server keeps its files
- `npm run models` : list Nemotron model IDs on the account
- `npm run eval` : score the pipeline on `eval/real` and `eval/fake`, writes `eval/report.md`

## Eval data
- `eval/real/*.jpg` + `eval/real/labels.json` : real Givelink deliveries, faces blurred. Gitignored, never commit.
- `eval/fake/` : AI images (label intact) and `stripped-*` copies made by `node scripts/make-fakes.mjs`. Images gitignored, labels tracked.
- Label format: `{ "file.jpg": { "items": [{ "name": "Dog toy", "quantity": 1, "unit": "toys" }], "expected": "approve" | "review" | "reject", "note": "..." } }`. The eval calls `/api/v1/verify`, so the server needs `VDC_API_KEYS`.

## Writing style for README, Devpost text, UI copy
Short sentences. Active voice. No em dashes or en dashes. No hype words.

## Feedback log
Append every Nebius or NVIDIA friction point to `FEEDBACK.md` the moment it happens: tool, step, what broke, fix idea.
This file becomes the required Devpost feedback section.
