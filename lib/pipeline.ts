import { askJson, isLive, models } from "./nebius";
import type { LatLon } from "./geo";
import { costOf, type Usage } from "./prices";
import { checkIntegrity, type Seen } from "./integrity";
import type {
  Decision,
  ImpactNote,
  IntegrityCheck,
  ItemCheck,
  Need,
  NeedItem,
  StepEvent,
  StepName,
  VerificationResult,
  VisionCheck,
} from "./types";

export type VerifyInput = {
  id?: string; // the delivery id, when verifying a known donation
  requestText: string; // the nonprofit's original ask, free text
  items?: NeedItem[]; // what the donor gave; when absent, read from requestText
  orgName: string;
  city: string;
  donorNames: string[]; // everyone whose gift is in this delivery
  photo: Buffer; // normalized JPEG: what the model sees and what gets stored
  original: Buffer; // bytes as uploaded (or their metadata header): camera data and AI labels live here
  seen: Seen[]; // fingerprints of earlier delivery photos
  orderCode?: string; // the supplier order this delivery came from, to match a packing slip against
  orgAt?: LatLon; // the nonprofit's address
  uploadAt?: LatLon; // where the phone was at upload, if the nonprofit shared it
};

type Emit = (e: StepEvent) => void;

async function step<T>(emit: Emit, name: StepName, model: string | undefined, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  emit({ type: "step", step: name, status: "running", model });
  try {
    const data = await fn();
    emit({ type: "step", step: name, status: "done", model, ms: Date.now() - t, data });
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ type: "step", step: name, status: "error", model, ms: Date.now() - t, error: msg });
    throw err;
  }
}

const itemLine = (i: NeedItem) => `${i.quantity} ${i.unit} of ${i.name}`;

// ---------- Step 1: turn the request and the gift into a checklist ----------
async function intake(input: VerifyInput, usage: Usage[]): Promise<Need> {
  if (!isLive()) return demoNeed(input);
  const given = input.items?.length ? input.items : null;
  const need = await askJson<Need>({
    usage,
    model: models.reasoning,
    think: false, // the donors' list is already the answer; this only adds condition and must-haves
    system:
      "You structure in-kind donations into a checklist a delivery photo can be checked against. " +
      "Return: items (list of {name, quantity (integer, 1 if unstated), unit}), condition ('new'|'gently_used'|'any'), category, " +
      "deadline (YYYY-MM-DD or null), mustHave (specific attributes a delivery photo should show, e.g. sizes, brand, sealed packaging).",
    user: given
      ? `The nonprofit asked: ${input.requestText}\nThe donor gave exactly these items (copy them as the items list): ${given.map(itemLine).join("; ")}`
      : input.requestText,
  });
  // The donor's list is the source of truth. The model only adds condition, deadline and must-haves.
  return { ...need, items: given ?? need.items ?? [], mustHave: need.mustHave ?? [] };
}

// ---------- Step 2: the vision model checks each item against the photo ----------
const VISION_HEDGE_MS = Number(process.env.VISION_HEDGE_MS || 20_000);
async function vision(input: VerifyInput, need: Need, usage: Usage[]): Promise<VisionCheck> {
  if (!isLive()) return demoVision(need);
  const dataUrl = `data:image/jpeg;base64,${input.photo.toString("base64")}`;
  const ask = (model: string) => askJson<VisionCheck>({
    usage,
    model,
    maxTokens: 700,
    system:
      "You audit delivery photos for a donation marketplace. Be skeptical and literal. Only report what is visible. " +
      // The answer's length sets the latency (about 12 tokens a second), so keep it short.
      "Answer with compact JSON on one line, no extra keys, every string under 12 words. " +
      "Return: itemsSeen (up to 5 short names), itemChecks (one entry per expected item, same order: {name, expected, seen (int or null if uncountable), " +
      "status ('seen' all or nearly all visible | 'partial' some visible | 'missing' not visible | 'unclear' can't tell), note (one short sentence), where (where it sits in the photo in a few words a person can follow, e.g. 'front left, blue bags' or 'not visible')}), " +
      "aiSuspicion ('none'|'some'|'strong': visual signs the image is AI-generated, e.g. garbled label text, melted shapes, impossible lighting, repeated textures), " +
      "condition ('new'|'used'|'damaged'|'unclear'), deliveryContext (one sentence: where this seems to be, e.g. shelter storage room, doorstep, stock photo), " +
      "concerns (list: stock imagery, screenshots, watermarks, wrong item, partial delivery, AI artifacts), confidence (0..1 that this photo proves the gift was delivered), " +
      "slip ({visible, orderCode, lines}: if a packing slip, invoice or shipping label is readable, copy its order or reference number exactly and its item lines as {name, quantity}; otherwise visible false, orderCode null, lines []).",
    user: [
      {
        type: "text",
        text:
          `Expected items:\n${need.items.map((i, n) => `${n + 1}. ${itemLine(i)}`).join("\n")}\n` +
          `Condition: ${need.condition}. Must show: ${need.mustHave.join(", ") || "n/a"}.`,
      },
      { type: "image_url", image_url: { url: dataUrl } },
    ],
  });
  // Gemma usually answers in 10 to 20s but sometimes stalls past 40s. If it hasn't answered by
  // VISION_HEDGE_MS (or fails), start the fallback too and take whichever answers first. The extra
  // call is only spent on slow checks. The result says which model answered.
  let answered = false;
  const primary = ask(models.vision).then((v) => ((answered = true), { v, model: models.vision }));
  const backup = new Promise<void>((go) => {
    const t = setTimeout(go, VISION_HEDGE_MS);
    primary.catch(() => (clearTimeout(t), go()));
  }).then(() => {
    if (answered) throw new Error("not needed");
    return ask(models.visionFallback).then((v) => ({ v, model: models.visionFallback }));
  });
  const { v, model } = await Promise.any([primary, backup]);
  // Keep one check per expected item, in order, even if the model skipped or renamed one.
  const itemChecks: ItemCheck[] = need.items.map((it, n) => {
    const c = v.itemChecks?.[n];
    return {
      name: it.name,
      expected: it.quantity,
      seen: typeof c?.seen === "number" ? c.seen : null,
      status: c?.status ?? "unclear",
      note: c?.note ?? "The model did not report on this item.",
      where: c?.where ?? "",
    };
  });
  // Compare a readable order code with the delivery's own. Only letters and digits count ("GL 2041" = "GL-2041").
  const norm = (s: string) => s.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const slip = v.slip?.visible
    ? { visible: true, orderCode: v.slip.orderCode ?? null, lines: v.slip.lines ?? [], matchesOrder: v.slip.orderCode && input.orderCode ? norm(v.slip.orderCode) === norm(input.orderCode) : null }
    : { visible: false, orderCode: null, lines: [], matchesOrder: null };
  return { ...v, itemChecks, aiSuspicion: v.aiSuspicion ?? "none", concerns: v.concerns ?? [], itemsSeen: v.itemsSeen ?? [], model, slip };
}

// ---------- Step 5: score + reasoning ----------
/** Share of the gift the photo proves, 0..1. Counts above what was given don't earn extra. */
export function coverage(checks: ItemCheck[]): number {
  if (!checks.length) return 0;
  const one = (c: ItemCheck) => {
    if (c.status === "missing") return 0;
    if (c.status === "unclear") return 0.3;
    const ratio = c.seen !== null && c.expected > 0 ? Math.min(1, c.seen / c.expected) : c.status === "seen" ? 1 : 0.5;
    return c.status === "seen" ? Math.max(ratio, 0.8) : Math.min(ratio, 0.8);
  };
  return checks.reduce((a, c) => a + one(c), 0) / checks.length;
}

function ruleScore(need: Need, v: VisionCheck, flags: string[], duplicate: boolean) {
  let s = Math.round(v.confidence * 40 + coverage(v.itemChecks) * 45);
  if (need.condition === "any" || (need.condition === "new" && v.condition === "new") || (need.condition === "gently_used" && v.condition !== "damaged")) s += 10;
  if (v.aiSuspicion === "some") s -= 15;
  if (v.aiSuspicion === "strong") s -= 40;
  s -= flags.length * 10;
  if (duplicate) s -= 50;
  return Math.max(0, Math.min(100, s));
}

async function decide(
  need: Need,
  v: VisionCheck,
  flags: string[],
  duplicate: boolean,
  aiLabel: IntegrityCheck["aiLabel"],
  notes: string[] = [],
  usage: Usage[] = [],
): Promise<Decision> {
  const score = ruleScore(need, v, flags, duplicate);
  // Two separate questions. Is the photo genuine? Does it show every product?
  // Only a fake, a reused photo, or one showing none of the gift is rejected. A genuine photo that
  // misses some products is "review": the nonprofit is told what's missing and may still send it.
  const fake = duplicate || aiLabel === "generated" || v.aiSuspicion === "strong";
  const showsNothing = v.itemChecks.every((c) => c.status === "missing");
  const complete = v.itemChecks.every((c) => c.status === "seen");
  const clean = aiLabel !== "edited" && v.aiSuspicion === "none" && notes.length === 0;
  const base: Decision["verdict"] = fake || showsNothing ? "reject" : complete && clean && score >= 75 ? "approve" : "review";
  if (!isLive()) return demoDecision(base, score, v, flags);
  // Clear cases (clean approve, obvious fake) go to Super. Borderline ones go to Ultra.
  const model = base === "review" ? models.escalation : models.reasoning;
  const d = await askJson<Omit<Decision, "score" | "model">>({
    usage,
    model,
    system:
      "You are the final reviewer for a donation delivery. A rule engine proposed a verdict. You may keep it or make it stricter (approve->review, review->reject), never looser. " +
      "'reject' means the photo is not genuine (AI-generated, reused, staged stock image) or shows none of the donated items. " +
      "A genuine photo where some items are missing, partly visible or hard to count is 'review', never 'reject': the nonprofit gets a notice and may retake it. " +
      "The photo is the only evidence a nonprofit provides: never ask for receipts, delivery slips, addresses or signatures. " +
      "Return verdict ('approve'|'review'|'reject'), reasons (2-4 short plain sentences a nonprofit ops person understands), " +
      "nextAction (one concrete instruction to the nonprofit, e.g. 'Retake the photo so the size labels on the coats are readable').",
    user: JSON.stringify({ need, vision: v, integrityFlags: flags, locationNotes: notes, duplicate, aiLabel, ruleScore: score, proposedVerdict: base }),
  });
  const order = { approve: 0, review: 1, reject: 2 } as const;
  let verdict = order[d.verdict] >= order[base] ? d.verdict : base;
  // The reviewer may only reject for a reason about the photo itself, not for missing items.
  const suspicious = flags.length > 0 || v.aiSuspicion !== "none";
  if (verdict === "reject" && base !== "reject" && !suspicious) verdict = "review";
  return { verdict, score, reasons: d.reasons, nextAction: d.nextAction, model };
}

// ---------- Step 6: draft the nonprofit's thank-you note ----------
// As on Givelink, the nonprofit sends the donors a thank-you note with the proof. The model drafts it,
// the nonprofit edits it before sending. Nothing is drafted for a rejected photo.
async function impact(input: VerifyInput, need: Need, v: VisionCheck, decision: Decision, usage: Usage[]): Promise<ImpactNote> {
  if (decision.verdict === "reject") {
    return { donorMessage: "" };
  }
  if (!isLive()) return demoImpact(input, need);
  return askJson<ImpactNote>({
    usage,
    model: models.writer,
    think: false,
    system:
      "Draft the thank-you note a nonprofit sends to the donors of a delivery that just arrived, in the nonprofit's voice (we). " +
      "Specific and warm: name the items and what they unlock for the people or animals served. No clichés, no exclamation marks, no em dashes. " +
      "donorMessage: 2-3 sentences addressed to all donors of this delivery.",
    user: JSON.stringify({ org: input.orgName, city: input.city, donors: input.donorNames, items: need.items, context: v.deliveryContext }),
  });
}

export async function runVerification(input: VerifyInput, emit: Emit): Promise<VerificationResult> {
  const id = input.id ?? "DLV-" + Date.now().toString(36).toUpperCase();
  const usage: Usage[] = []; // every model call's tokens, for the cost of this check
  const done = (r: Omit<VerificationResult, "id" | "mode" | "models" | "usage" | "cost">): VerificationResult => ({
    id, mode: isLive() ? "live" : "demo", models: isLive() ? { ...models } : undefined, ...r, usage, cost: costOf(usage),
  });

  // 1. Is the photo genuine? Instant and free, so it goes first. The nonprofit is already verified by
  //    the platform it signs in to, so there's no org lookup.
  const integrity = await step(emit, "integrity", undefined, () =>
    checkIntegrity(input.original, input.photo, id, input.seen, input.orgAt, input.uploadAt),
  );
  const given: Need | null = input.items?.length
    ? { items: input.items, condition: "any", category: "", deadline: null, mustHave: [] }
    : null;

  // An AI-labeled or reused photo stops here: no model call can make it genuine, so none is spent.
  if (integrity.aiLabel === "generated" || integrity.duplicateOf) {
    const need = given ?? demoNeed(input);
    for (const s of ["intake", "vision", "decision", "impact"] as const) emit({ type: "step", step: s, status: "skipped" });
    return done({
      need,
      vision: {
        itemsSeen: [], condition: "unclear", deliveryContext: "", concerns: [], confidence: 0, aiSuspicion: "none",
        itemChecks: need.items.map((i) => ({ name: i.name, expected: i.quantity, seen: null, status: "unclear", note: "Not checked: the photo failed the genuine check.", where: "" })),
      },
      integrity,
      decision: {
        verdict: "reject",
        score: 0,
        reasons: integrity.flags.slice(0, 3),
        nextAction: "Take a new photo of the delivered items with the app camera.",
        model: "rules",
      },
      impact: { donorMessage: "" },
    });
  }

  // 2. Read the gift and look at the photo. With the donor's items known, both run at once.
  const [need, v] = given
    ? await Promise.all([
        step(emit, "intake", isLive() ? models.reasoning : undefined, () => intake(input, usage)),
        step(emit, "vision", isLive() ? models.vision : undefined, () => vision(input, given, usage)),
      ])
    : await (async () => {
        const n = await step(emit, "intake", isLive() ? models.reasoning : undefined, () => intake(input, usage));
        return [n, await step(emit, "vision", isLive() ? models.vision : undefined, () => vision(input, n, usage))] as const;
      })();

  // A slip from a different order is a doubt about the photo, like a reused photo.
  if (v.slip?.matchesOrder === false) {
    integrity.flags.push(`The packing slip shows order ${v.slip.orderCode}, not this delivery's ${input.orderCode}.`);
  }
  const decision = await step(emit, "decision", isLive() ? "Nemotron 3 Super, or Ultra when borderline" : undefined, () =>
    decide(need, v, integrity.flags, Boolean(integrity.duplicateOf), integrity.aiLabel, integrity.notes, usage),
  );
  const note = await step(emit, "impact", isLive() ? models.writer : undefined, () => impact(input, need, v, decision, usage));

  return done({ need, vision: v, integrity, decision, impact: note });
}

// ---------- Demo mode (no API key): deterministic stand-ins so the UI works offline ----------
function demoNeed(input: VerifyInput): Need {
  const text = input.requestText;
  const items = input.items?.length
    ? input.items
    : [{ name: text.replace(/^.*?\d+\s*/, "").split(/[.,;\n]/)[0].trim().slice(0, 60) || "requested items", quantity: Number(text.match(/\b(\d{1,4})\b/)?.[1] ?? 1), unit: "units" }];
  return { items, condition: /new/i.test(text) ? "new" : "any", category: "General", deadline: null, mustHave: [] };
}
function demoVision(need: Need): VisionCheck {
  return {
    itemsSeen: need.items.map((i) => i.name),
    itemChecks: need.items.map((i, n) => ({ name: i.name, expected: i.quantity, seen: i.quantity, status: "seen", note: "Demo mode: simulated.", where: ["front left", "center", "front right", "back row"][n % 4] })),
    aiSuspicion: "none",
    condition: need.condition === "new" ? "new" : "used",
    deliveryContext: "Demo mode: vision is simulated. Add NEBIUS_API_KEY to run the model on the real photo.",
    concerns: [],
    confidence: 0.82,
  };
}
function demoDecision(verdict: Decision["verdict"], score: number, v: VisionCheck, flags: string[]): Decision {
  const shown = v.itemChecks.filter((c) => c.status === "seen").length;
  return {
    verdict,
    score,
    reasons: [`The photo shows ${shown} of ${v.itemChecks.length} items.`, ...flags].slice(0, 4),
    nextAction: verdict === "approve" ? "Release the donor thank-you." : "Retake the photo at the receiving location with every item visible.",
  };
}
function demoImpact(input: VerifyInput, need: Need): ImpactNote {
  const list = need.items.map(itemLine).join(", ");
  return {
    donorMessage: `Thank you. Your gift (${list}) arrived at ${input.orgName || "our place"} and is already in use.`,
  };
}
