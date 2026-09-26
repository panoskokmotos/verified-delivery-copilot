# Verified Delivery Copilot

Donors give goods, not cash. Then they never learn if the goods arrived. Nonprofits send a delivery photo, and a human has to check it. That check is slow, and it is easy to fake with an old or stock photo.

Verified Delivery Copilot is an agent that checks the photo for you. It reads what the nonprofit asked for, looks at the delivery photo with a vision model, checks the photo is genuine, confirms the nonprofit exists, and decides: approve, send to a human, or reject. The donor gets a specific thank-you only after approval.

Built by the team behind [Givelink](https://givelink.app), a marketplace where donors fill specific needs of verified nonprofits and every delivery is photo-confirmed (7,000+ confirmed deliveries so far). This repo is a standalone, open source version of that verification step.

## How it works

```
nonprofit request (text) ──► 1. Intake        Nemotron 3 Super   → structured checklist
delivery photo ────────────► 2. Vision        Gemma 3 27B        → item, count, condition, setting, concerns
                         ├─► 3. Integrity     local              → EXIF time window, reused-photo fingerprint (dHash)
                         └─► 4. Org check     Tavily             → does the nonprofit exist?
                               5. Decision    rules + Nemotron 3 Super (may only make the verdict stricter)
                               6. Impact note Nemotron Nano      → donor thank-you, only if approved
```

Steps 2, 3 and 4 run in parallel. The UI streams each step as it finishes.

Safety choices:

- The rule score sets the ceiling. The LLM reviewer can move a verdict from approve to review, or review to reject, never the other way.
- A photo that matches an earlier delivery is rejected, even if it looks perfect.
- No donor message is written until the delivery is approved.

## Run it

```bash
npm install
cp .env.example .env.local   # add NEBIUS_API_KEY (and TAVILY_API_KEY if you have one)
npm run models               # prints the exact Nemotron model IDs on your account
npm run dev                  # http://localhost:3000
```

With no API key the app runs in demo mode: vision and reasoning are simulated, the integrity checks are real.

## Stack

- Nebius Token Factory (OpenAI-compatible API) for all model calls
- NVIDIA Nemotron 3 Super (reasoning) and Nemotron 3 Nano (writing)
- Gemma 3 27B for vision, also on Token Factory. Nemotron Nano Omni is not available there yet
- Tavily search for the nonprofit check
- Next.js 15, sharp, exifr

## License

MIT
