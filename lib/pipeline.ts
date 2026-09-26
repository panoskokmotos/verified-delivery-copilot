import { askJson, isLive, models } from "./nebius";
import { checkIntegrity } from "./integrity";
import { checkOrg } from "./tavily";
import type { Decision, ImpactNote, IntegrityCheck, Need, StepEvent, StepName, VerificationResult, VisionCheck } from "./types";

export type VerifyInput = {
  requestText: string; // the nonprofit's original ask, free text
  orgName: string;
  city: string;
  donorName: string;
  photo: Buffer;
  photoMime: string;
  dryRun?: boolean; // eval runs: do not remember this photo for duplicate checks
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

// ---------- Step 1: turn a messy request into a structured need ----------
async function intake(input: VerifyInput): Promise<Need> {
  if (!isLive()) return demoNeed(input.requestText);
  return askJson<Need>({
    model: models.reasoning,
    system:
      "You structure in-kind donation requests from nonprofits. Extract: item (short noun phrase), quantity (integer, 1 if unstated), unit, condition ('new'|'gently_used'|'any'), category, deadline (YYYY-MM-DD or null), mustHave (list of specific attributes that a delivery photo should show, e.g. sizes, brand, sealed packaging).",
    user: input.requestText,
  });
}

// ---------- Step 2: NVIDIA Nemotron looks at the delivery photo ----------
async function vision(input: VerifyInput, need: Need): Promise<VisionCheck> {
  if (!isLive()) return demoVision(need);
  const dataUrl = `data:${input.photoMime};base64,${input.photo.toString("base64")}`;
  return askJson<VisionCheck>({
    model: models.vision,
    maxTokens: 900,
    system:
      "You audit delivery photos for a donation marketplace. Be skeptical and literal. Only report what is visible. " +
      "Return: itemsSeen (list), matchesNeed (bool), estimatedCount (int or null), countConfidence ('low'|'medium'|'high'), " +
      "condition ('new'|'used'|'damaged'|'unclear'), deliveryContext (one sentence: where this seems to be, e.g. shelter storage room, doorstep, stock photo), " +
      "concerns (list: signs of stock imagery, screenshots, watermarks, wrong item, partial delivery), confidence (0..1 that this photo proves the need was delivered).",
    user: [
      { type: "text", text: `The nonprofit asked for: ${need.quantity} ${need.unit} of ${need.item} (condition: ${need.condition}). Must show: ${need.mustHave.join(", ") || "n/a"}.` },
      { type: "image_url", image_url: { url: dataUrl } },
    ],
  });
}

// ---------- Step 5: score + reasoning ----------
function ruleScore(need: Need, v: VisionCheck, flags: string[], duplicate: boolean, orgFound: boolean | null) {
  let s = Math.round(v.confidence * 55);
  if (v.matchesNeed) s += 20;
  if (v.estimatedCount !== null && v.estimatedCount >= need.quantity * 0.8) s += 10;
  if (need.condition === "any" || (need.condition === "new" && v.condition === "new") || (need.condition === "gently_used" && v.condition !== "damaged")) s += 10;
  if (orgFound) s += 5;
  s -= flags.length * 10;
  if (duplicate) s -= 50;
  return Math.max(0, Math.min(100, s));
}

async function decide(
  need: Need,
  v: VisionCheck,
  flags: string[],
  duplicate: boolean,
  orgFound: boolean | null,
  aiLabel: IntegrityCheck["aiLabel"],
): Promise<Decision> {
  const score = ruleScore(need, v, flags, duplicate, orgFound);
  // A reused or AI-generated photo is always rejected. An AI-edited one never auto-approves.
  const byScore: Decision["verdict"] = score >= 75 ? "approve" : score >= 45 ? "review" : "reject";
  const base: Decision["verdict"] =
    duplicate || aiLabel === "generated" ? "reject" : aiLabel === "edited" && byScore === "approve" ? "review" : byScore;
  if (!isLive()) return demoDecision(base, score, v, flags);
  const d = await askJson<Omit<Decision, "score">>({
    model: models.reasoning,
    system:
      "You are the final reviewer for a donation delivery. A rule engine proposed a verdict. You may keep it or make it stricter (approve->review, review->reject), never looser. " +
      "Return verdict ('approve'|'review'|'reject'), reasons (2-4 short plain sentences a nonprofit ops person understands), nextAction (one concrete instruction, e.g. 'Ask the shelter for a second photo showing the size labels').",
    user: JSON.stringify({ need, vision: v, integrityFlags: flags, duplicate, aiLabel, orgFound, ruleScore: score, proposedVerdict: base }),
  });
  const order = { approve: 0, review: 1, reject: 2 } as const;
  const verdict = order[d.verdict] >= order[base] ? d.verdict : base;
  return { verdict, score, reasons: d.reasons, nextAction: d.nextAction };
}

// ---------- Step 6: close the loop with the donor ----------
async function impact(input: VerifyInput, need: Need, v: VisionCheck, decision: Decision): Promise<ImpactNote> {
  if (decision.verdict !== "approve") {
    return { donorMessage: "Held until the delivery is confirmed. The donor gets no message yet.", publicCaption: "" };
  }
  if (!isLive()) return demoImpact(input, need, v);
  return askJson<ImpactNote>({
    model: models.writer,
    system:
      "Write a short thank-you for a donor whose in-kind gift was just confirmed delivered. Specific, warm, no clichés, no exclamation marks, no em dashes. " +
      "Mention the exact item, count, and the organization. donorMessage: 2-3 sentences. publicCaption: one sentence for a public impact feed, no donor name.",
    user: JSON.stringify({ donor: input.donorName, org: input.orgName, city: input.city, need, seen: v.itemsSeen, context: v.deliveryContext }),
  });
}

export async function runVerification(input: VerifyInput, emit: Emit): Promise<VerificationResult> {
  const id = "DLV-" + Date.now().toString(36).toUpperCase();
  const need = await step(emit, "intake", isLive() ? models.reasoning : undefined, () => intake(input));

  // Photo check, integrity, and org lookup run in parallel.
  const [v, integrity, org] = await Promise.all([
    step(emit, "vision", isLive() ? models.vision : undefined, () => vision(input, need)),
    step(emit, "integrity", undefined, () => checkIntegrity(input.photo, id, need, !input.dryRun)),
    step(emit, "org", process.env.TAVILY_API_KEY ? "tavily" : undefined, () => checkOrg(input.orgName, input.city)),
  ]);

  const decision = await step(emit, "decision", isLive() ? models.reasoning : undefined, () =>
    decide(need, v, integrity.flags, Boolean(integrity.duplicateOf), org.ran ? org.found : null, integrity.aiLabel),
  );
  const note = await step(emit, "impact", isLive() ? models.writer : undefined, () => impact(input, need, v, decision));

  return { id, mode: isLive() ? "live" : "demo", need, vision: v, integrity, org, decision, impact: note };
}

// ---------- Demo mode (no API key): deterministic stand-ins so the UI works offline ----------
function demoNeed(text: string): Need {
  const qty = Number(text.match(/\b(\d{1,4})\b/)?.[1] ?? 1);
  const item = text.replace(/^.*?\d+\s*/, "").split(/[.,;\n]/)[0].trim().slice(0, 60) || "requested items";
  return { item, quantity: qty, unit: "units", condition: /new/i.test(text) ? "new" : "any", category: "General", deadline: null, mustHave: [] };
}
function demoVision(need: Need): VisionCheck {
  return {
    itemsSeen: [need.item],
    matchesNeed: true,
    estimatedCount: need.quantity,
    countConfidence: "medium",
    condition: need.condition === "new" ? "new" : "used",
    deliveryContext: "Demo mode: vision is simulated. Add NEBIUS_API_KEY to run Nemotron on the real photo.",
    concerns: [],
    confidence: 0.82,
  };
}
function demoDecision(verdict: Decision["verdict"], score: number, v: VisionCheck, flags: string[]): Decision {
  return {
    verdict,
    score,
    reasons: [v.matchesNeed ? "The photo shows the requested item." : "The photo does not clearly show the requested item.", ...flags].slice(0, 4),
    nextAction: verdict === "approve" ? "Release the donor thank-you." : "Ask the nonprofit for a second photo at the receiving location.",
  };
}
function demoImpact(input: VerifyInput, need: Need, v: VisionCheck): ImpactNote {
  return {
    donorMessage: `${input.donorName || "Hi"}, your ${v.estimatedCount ?? need.quantity} ${need.item} arrived at ${input.orgName || "the nonprofit"} and the team confirmed it with a photo. Thank you for filling a real, specific need.`,
    publicCaption: `${need.quantity} ${need.item} delivered to ${input.orgName || "a verified nonprofit"} in ${input.city || "their city"}, photo-confirmed.`,
  };
}
