import type { VerificationResult } from "./types";

/**
 * Did the photo pass the check? Complete, or genuine but partial with nothing casting doubt on the photo
 * itself. In the eval, screenshotted AI images mostly landed in "review", so a doubtful review is not verified.
 */
export function verified(r: VerificationResult): boolean {
  if (r.mode !== "live") return false; // a simulated check proves nothing
  if (r.decision.verdict === "approve") return !doubtful(r);
  return r.decision.verdict === "review" && !doubtful(r);
}

/**
 * Something casts doubt on the photo itself, not on which items show: signs of AI, an AI label,
 * integrity flags (reuse, taken before the delivery date), or a catalog, stock or screenshot image.
 */
export function doubtful(r: VerificationResult): boolean {
  // "No stock imagery" is a clean bill, not a concern.
  const notAPhotoOfTheDelivery = r.vision.concerns.some((c) => !/^\s*(no|none|not)\b/i.test(c) && /stock|catalog|studio|screenshot|watermark/i.test(c));
  return r.vision.aiSuspicion !== "none" || r.integrity.flags.length > 0 || Boolean(r.integrity.aiLabel) || notAPhotoOfTheDelivery;
}

/**
 * May the nonprofit send it at all? Anything that isn't a proven fake may go out, so honest nonprofits
 * never get stuck; donors then see "Not verified" and what the check found. An AI-labeled or reused
 * photo, or a check that never ran, can't be sent.
 */
export function sendable(r: VerificationResult): boolean {
  return r.mode === "live" && r.integrity.aiLabel !== "generated" && !r.integrity.duplicateOf;
}

/** Every product fully visible in the photo. */
export const complete = (r: VerificationResult) => r.vision.itemChecks.every((c) => c.status === "seen");

/** Nothing proves the photo fake: no AI label, not a reused photo, no strong visual signs of AI. */
export const genuine = (r: VerificationResult) =>
  !r.integrity.duplicateOf && r.integrity.aiLabel !== "generated" && r.vision.aiSuspicion !== "strong";
