# Verified Delivery Copilot

Hackathon entry: Nebius x NVIDIA Global AI Hackathon, track "Best Apps and Agents".
Deadline: Fri Oct 30, 2026, 10:00 AM PT. Submit by Oct 28.

## What it does
Agent that checks a nonprofit's delivery photo against the original request.
Pipeline in `lib/pipeline.ts`: intake, vision, integrity, org check, decision, impact note.

## Hard rules (the hackathon checks these)
- Every model call goes through Nebius Token Factory (`lib/nebius.ts`). No other LLM provider.
- At least one NVIDIA Nemotron model is used at runtime. Model IDs come from env vars only.
- Never commit secrets. Keys live in `.env.local` only.
- Repo stays public and MIT.

## Product rules
- The LLM reviewer can only make a verdict stricter, never looser. Keep this in `decide()`.
- No donor message before approval.
- A reused photo is always rejected.

## Commands
- `npm run dev` : local app on :3000
- `npm run build` : must pass before every commit
- `npm run models` : list Nemotron model IDs on the account
- `npm run eval` : score the pipeline on `eval/real` and `eval/fake`, writes `eval/report.md`

## Eval data
- `eval/real/*.jpg` + `eval/real/labels.json` : real deliveries, faces and addresses blurred. Gitignored.
- `eval/fake/*.jpg` + `eval/fake/labels.json` : stock, reused, wrong-item photos.
- Label format: `{ "file.jpg": { "request": "...", "expected": "approve" | "review" | "reject" } }`

## Writing style for README, Devpost text, UI copy
Short sentences. Active voice. No em dashes or en dashes. No hype words.

## Feedback log
Append every Nebius or NVIDIA friction point to `FEEDBACK.md` the moment it happens: tool, step, what broke, fix idea.
This file becomes the required Devpost feedback section.
