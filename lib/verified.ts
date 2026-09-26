import type { VerificationResult } from "./types";

/**
 * Did the photo pass the check? Complete, or genuine but partial with nothing casting doubt on the photo
 * itself. In the eval, screenshotted AI images mostly landed in "review", so a doubtful review is not verified.
 */
export function verified(r: VerificationResult): boolean {
  if (r.mode !== "live") return false; // a simulated check proves nothing
  if (r.decision.verdict === "approve") return true;
  return r.decision.verdict === "review" && r.vision.aiSuspicion === "none" && r.integrity.flags.length === 0 && !r.integrity.aiLabel;
}

/**
 * May the nonprofit send it at all? Anything that isn't a proven fake may go out, so honest nonprofits
 * never get stuck; donors then see "Not verified" and what the check found. An AI-labeled or reused
 * photo, or a check that never ran, can't be sent.
 */
export function sendable(r: VerificationResult): boolean {
  return r.mode === "live" && r.integrity.aiLabel !== "generated" && !r.integrity.duplicateOf;
}
