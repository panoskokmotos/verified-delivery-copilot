import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// Signs a check result so the nonprofit can confirm it later without re-running the models,
// and without being able to edit the result in the browser in between.
// Set RECEIPT_SECRET in production: serverless instances don't share the dev fallback.
const SECRET = process.env.RECEIPT_SECRET || randomBytes(32).toString("hex");

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

const TOKEN_TTL_MS = 30 * 60_000;
const mac = (issuedAt: string, deliveryId: string, photo: Buffer, resultJson: string) =>
  createHmac("sha256", SECRET).update(`${issuedAt}|${deliveryId}|${sha256(photo)}|${sha256(resultJson)}`).digest("hex");

/** A token for this exact check and photo, valid for 30 minutes: "<issued at ms>.<hmac>". */
export function signCheck(deliveryId: string, photo: Buffer, resultJson: string): string {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${mac(issuedAt, deliveryId, photo, resultJson)}`;
}

export function verifyCheck(deliveryId: string, photo: Buffer, resultJson: string, token: string): boolean {
  const [issuedAt, got] = token.split(".");
  if (!issuedAt || !got || !(Date.now() - Number(issuedAt) < TOKEN_TTL_MS)) return false;
  const want = Buffer.from(mac(issuedAt, deliveryId, photo, resultJson), "hex");
  const have = Buffer.from(got, "hex");
  return have.length === want.length && timingSafeEqual(have, want);
}
