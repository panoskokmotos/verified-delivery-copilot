import { complete, genuine, verified } from "./verified";
import type { Delivery } from "./types";

// Open delivery receipt, format "delivery-receipt/v1". Schema: docs/receipt.schema.json.
// Anyone can issue or read one: a marketplace, a wishlist site, a food bank network.
// Donor names are left out on purpose. A donor who wants to be named shares their own link.

export type Receipt = {
  schema: "delivery-receipt/v1";
  id: string;
  issuedAt: string;
  issuer: { name: string; url: string };
  nonprofit: { name: string; city: string; cause: string };
  shipment: { supplier: string; orderCode: string; arrivedAt: string };
  donations: { donor: string; items: { name: string; quantity: number }[] }[];
  items: {
    name: string;
    expected: number;
    seen: number | null;
    status: "seen" | "partial" | "missing" | "unclear";
    where: string;
    note: string;
  }[];
  photo: { sha256: string | null; dhash: string; url: string };
  checks: {
    genuine: boolean;
    aiContentLabel: "generated" | "edited" | null;
    reusedPhoto: boolean;
    visualAiSigns: "none" | "some" | "strong";
    cameraTimestamp: string | null;
    takenInApp: boolean;
    locationSharedWithPlatform: boolean;
    packingSlipMatchesOrder: boolean | null;
    complete: boolean;
    passedCheck: boolean; // false: the nonprofit sent it without the photo passing the check
    confirmedByNonprofit: boolean;
  };
  verdict: "complete" | "partial" | "unverified";
  score: number;
  limits: string[];
  thankYouNote: string | null;
  models: { vision: string; reasoning: string; writer: string } | null;
};

/** What the check could not establish. Printed on every receipt. */
export function receiptLimits(d: Delivery): string[] {
  const r = d.result!;
  const out = r.vision.itemChecks.filter((c) => c.status !== "seen").map((c) => `${c.name}: ${c.note}`);
  if (!verified(r)) out.unshift(`The photo didn't pass the check, and the nonprofit sent it anyway. ${r.decision.reasons[0] ?? ""}`.trim());
  out.push("Counts come from one photo taken from one angle, so items behind others may be missed.");
  out.push("The photo shows the whole delivery. It can't show which unit came from which donor.");
  if (!r.capture?.inApp) out.push("The photo was picked from the phone's gallery, not taken live in the app, so it could be older or from elsewhere.");
  else out.push("\"Taken in the app\" is reported by the app itself. A tampered phone could fake it.");
  if (!r.integrity.photoTakenAt) out.push("The photo has no camera timestamp (common for photos sent over WhatsApp), so we can't say when it was taken.");
  if (!r.integrity.aiLabel) out.push("AI images whose label was stripped, for example by a screenshot, are caught only by the visual check, which is weaker.");
  return out;
}

/** A shared proof as an open receipt. Returns null until the nonprofit has shared a checked photo. */
export function toReceipt(d: Delivery, origin: string): Receipt | null {
  const r = d.result;
  if (d.status !== "approve" || !r) return null;
  const whole = complete(r);
  return {
    schema: "delivery-receipt/v1",
    id: d.id,
    issuedAt: d.updatedAt ?? "",
    issuer: { name: "Verified Delivery Copilot", url: origin },
    nonprofit: { name: d.orgName, city: d.city, cause: d.cause },
    shipment: { supplier: d.supplier, orderCode: d.orderCode, arrivedAt: d.arrivesAt },
    donations: d.donations.map((x, i) => ({ donor: `donor-${i + 1}`, items: x.items.map(({ name, quantity }) => ({ name, quantity })) })),
    items: r.vision.itemChecks.map((c) => ({ name: c.name, expected: c.expected, seen: c.seen, status: c.status, where: c.where, note: c.note })),
    photo: { sha256: d.photoSha256 ?? null, dhash: r.integrity.hash, url: `${origin}/api/photo/${d.id}` },
    checks: {
      genuine: genuine(r),
      aiContentLabel: r.integrity.aiLabel,
      reusedPhoto: Boolean(r.integrity.duplicateOf),
      visualAiSigns: r.vision.aiSuspicion,
      cameraTimestamp: r.integrity.photoTakenAt,
      takenInApp: Boolean(r.capture?.inApp),
      locationSharedWithPlatform: Boolean(r.capture?.location),
      packingSlipMatchesOrder: r.vision.slip?.matchesOrder ?? null,
      complete: whole,
      passedCheck: verified(r),
      confirmedByNonprofit: true,
    },
    verdict: !verified(r) ? "unverified" : whole ? "complete" : "partial",
    score: r.decision.score,
    limits: receiptLimits(d),
    thankYouNote: d.thankYouNote ?? null,
    models: r.models ?? null,
  };
}

