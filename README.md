# Verified Delivery Copilot

**Live demo:** https://verified-delivery-copilot.vercel.app · **License:** MIT · Built for the Nebius x NVIDIA Global AI Hackathon, Best Apps and Agents track

On giving platforms like [Givelink](https://givelink.app), donors buy specific items a nonprofit needs, and the nonprofit sends a photo when they arrive. Givelink has confirmed more than 7,000 deliveries this way, each photo checked by a person. That check no longer holds up on its own: anyone can make a convincing delivery photo with a free AI image tool in seconds.

Verified Delivery Copilot is an AI agent that checks each delivery photo before donors see it:

1. **Is the photo genuine?** It reads the AI content label (C2PA / IPTC) that Google, OpenAI and Adobe embed in generated images, and compares a fingerprint with earlier delivery photos. A fake stops here, before any model runs.
2. **Does it show every item?** A delivery batches the gifts of several donors. A vision model checks each product, counts it, says where it sits in the photo, and reads any packing slip against the order code.
3. **Decide.** A rule score sets the ceiling. NVIDIA Nemotron 3 Super reviews it, and borderline cases go to Nemotron 3 Ultra. The model can only make the verdict stricter.
4. **The nonprofit sees it first.** Every product gets a green tick, or a notice if it isn't fully visible. A genuine partial photo can be sent as is. A photo that fails can still be sent, but every donor sees it marked **Not verified**, with what the check found.
5. **Close the loop.** Nemotron 3 Nano drafts the thank-you note, the nonprofit edits and sends it, and each donor gets a receipt: their own items numbered next to the photo, what was checked, and what a photo can't prove.

It starts upstream, with the **wishlist**. A nonprofit lists the products it needs by pasting a product link or typing a name. Before any donor sees a product, the agent finds its official photo and searches **US CPSC, SaferProducts.gov and the EU Safety Gate** for recalls of that exact product (with Tavily), and Nemotron decides whether a notice really matches. A recalled product can't be given. The official photo later helps the vision model recognise the real packaging in the delivery photo, and the receipt says the products were checked for recalls.

Privacy is built in: faces can be blurred on the phone before upload (the nonprofit switches it on), location goes to the platform only, and public receipts never name donors.

## Try it (2 minutes)

1. Open the [live demo](https://verified-delivery-copilot.vercel.app) and tap **Start as the nonprofit**.
2. Pick any delivery marked **Arrived**, tap **Open camera** (or choose a photo), and tap **Check photo**. It takes about 15 to 20 seconds.
3. Send it, then open **Donors** and pick one of that delivery's donors to see the receipt.
4. Open **Wishlists** to give a product; the gift becomes a new delivery you can check. As the nonprofit, open **Your wishlist** and add a product by link or name: the recall check takes about 10 seconds. Try adding "Fisher-Price Rock n Play Sleeper".

To try to fool it: upload an image made with ChatGPT or Gemini, a photo showing only some of the items, or a photo for the delivery that hasn't arrived yet. The nonprofits and donors are fictional, and demo deliveries reset a few hours after a check.

## How we used NVIDIA Nemotron and Nebius Token Factory

Every model call goes through [Nebius Token Factory](https://tokenfactory.nebius.com)'s OpenAI-compatible API with one key and one base URL. Models are routed by difficulty, so the big model is only spent where reasoning matters:

| Step | Model | Why this size |
|---|---|---|
| Checklist from the donors' items | `nvidia/nemotron-3-super-120b-a12b` | Reliable structured JSON, fast enough for every check |
| Everyday decision | `nvidia/nemotron-3-super-120b-a12b` | Same |
| Borderline decision (genuine but incomplete, or uncertain) | `nvidia/Nemotron-3-Ultra-550b-a55b` | A wrong call here costs a donor's trust, so it gets the strongest reasoning |
| Thank-you draft, JSON repair | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | Speed matters more than depth |
| Does a recall notice match this exact product? | `nvidia/nemotron-3-super-120b-a12b` | A short yes/no over search results; it can only cite a notice that was actually found |
| Vision | `google/gemma-3-27b-it`, fallback `openbmb/MiniCPM-V-4_5` | No Nemotron vision model was available on our Token Factory account |

- **Cost per check** is shown on every check, from the token usage Token Factory returns: about **$0.001** for a typical photo.
- A fake with an AI label costs **zero** model calls: the free checks run first.
- **Reasoning only where it pays.** Nemotron 3 thinks before answering unless told not to. The checklist, the thank-you note and the recall match run with thinking off (`chat_template_kwargs.enable_thinking: false`); the decision keeps it. The note went from 811 output tokens and 10.6 s to about 70 tokens and 1.1 s, and a whole check from 32 to 51 s to **13 to 20 s**.
- **The backup vision model is raced, not waited for.** If Gemma hasn't answered after 20 s, MiniCPM-V starts too and the first answer wins.
- Hard caps keep spend bounded: `NEBIUS_MAX_CALLS_PER_DAY` (default 300) and `MAX_VERIFICATIONS_PER_MONTH` (default 300).
- **Nebius Serverless AI Jobs** run the evaluation in the background against the deployed app: see [Evaluation](#evaluation).

Code: [lib/nebius.ts](lib/nebius.ts) (client, routing, caps), [lib/pipeline.ts](lib/pipeline.ts) (the agent), [lib/prices.ts](lib/prices.ts) (cost).

## Run it locally

Needs Node 20 or newer and a Nebius Token Factory API key.

```bash
git clone https://github.com/panoskokmotos/verified-delivery-copilot
cd verified-delivery-copilot
npm install
cp .env.example .env.local
```

Open `.env.local` and set at least:

| Variable | What it is |
|---|---|
| `NEBIUS_API_KEY` | Your Token Factory API key. Without it the app runs in demo mode with simulated results, which can never be sent to donors |
| `RECEIPT_SECRET` | Any long random string, e.g. from `openssl rand -hex 32`. Signs a check so it can't be edited between checking and sending |
| `VDC_API_KEYS` | Comma-separated keys for the platform API and the eval. Optional |

The rest have working defaults (see `.env.example`). Then:

```bash
npm run models   # lists the models on your account
npm run dev      # http://localhost:3000
```

### Deploy on Vercel

Import the repo on Vercel, set `NEBIUS_API_KEY` and `RECEIPT_SECRET`, and connect a **private** Blob store (Storage → Create → Blob), which adds `BLOB_READ_WRITE_TOKEN`. Redeploy after changing variables. `/api/health` shows `"mode":"live","missing":[]` when everything is set; a check refuses to run while anything is missing.

## For platforms

- **API:** `POST /api/v1/verify` with a photo and the list of donated items returns the verdict, a check for each item, packing slip, cost and a thank-you draft. Stateless. See [docs/api.md](docs/api.md).
- **Open receipt format:** `GET /api/receipts/{id}`, schema in [docs/receipt.schema.json](docs/receipt.schema.json). Donors are anonymized and there are no coordinates.
- **Open data:** `/stats`, plus `/api/stats` and `/api/stats?format=csv`.

## Evaluation

`npm run eval` sends every labelled photo in `eval/real/` and `eval/fake/` through `/api/v1/verify` and writes `eval/report.md`. Real delivery photos stay local: `eval/real/` is gitignored.

To run it as a **Nebius Serverless AI Job**, put the labelled photos in a private Nebius Object Storage bucket and run [scripts/nebius-eval-job.sh](scripts/nebius-eval-job.sh). It mounts the bucket into a `node:22-slim` job and writes the report back.

Results so far, on 16 fakes made with Gemini and ChatGPT:

- **8 of 8** with their AI label intact were rejected, with zero model calls.
- With the label stripped (as a screenshot does), **1 of 8** was rejected and 3 more were flagged as doubtful, so they can't be sent as verified. **4 of 8 were not caught.** This is why every receipt lists what a photo can't prove.
- Real Givelink deliveries: [pending].

## Limits

- A photo shows that items were present once. It can't show they were used, or that they stayed.
- Without the AI label, a good AI image can pass the visual check. The label check, the reuse fingerprint, the live in-app camera and the delivery-date check make that harder, not impossible.
- No model on Token Factory could locate objects with boxes, so item positions are described in words.
- "No recalls found" means no notice in CPSC, SaferProducts.gov or the EU Safety Gate matched the product name when it was added. It is a search, not a certification, and it isn't re-run later.
- Amazon doesn't allow its pages to be read, so an Amazon link needs the product name too.

## Tavily

Used only when a nonprofit adds a product to its wishlist: 2 calls per new product (read the product page or find its photo, then search the recall databases), cached per product, with a shared daily cap (`TAVILY_MAX_CALLS_PER_DAY`, default 40) and a stop before the monthly credits run out (`TAVILY_CREDIT_RESERVE`, read from Tavily's free usage endpoint). Code: [lib/tavily.ts](lib/tavily.ts), [lib/products.ts](lib/products.ts).

## Feedback on Nebius and NVIDIA

Logged as it happened in [FEEDBACK.md](FEEDBACK.md). In short:

- **A Nemotron vision model on Token Factory** would let the whole pipeline run on Nemotron. Nano Omni isn't on our account, and the 4 Nemotron models listed return 400 for image input.
- **`/v1/models` has no input modalities**, so we sent a test image to every model to find one that accepts images.
- **Model IDs don't follow one naming scheme** (`nemotron-3-super-120b-a12b` vs `NVIDIA-Nemotron-3-Nano-30B-A3B`).
- **Vision latency varied from 3 to 59 seconds** on the same small image. Per-model latency or queue status would help.
- **Object grounding:** neither vision model could put boxes around products.
- What worked well: drop-in OpenAI compatibility, so no new client code, and switching models is one environment variable, which made Super/Ultra routing trivial.

## New during the submission period

Every line of this repo was written during the submission period. It is inspired by Givelink's manual photo check and shares no code with Givelink.

## License

[MIT](LICENSE)
