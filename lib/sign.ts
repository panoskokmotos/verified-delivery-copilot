import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// Signs a check result so the nonprofit can confirm it later without re-running the models,
// and without being able to edit the result in the browser in between.
// Set RECEIPT_SECRET in production: serverless instances don't share the dev fallback.
const SECRET = process.env.RECEIPT_SECRET || randomBytes(32).toString("hex");

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export function signCheck(deliveryId: string, photo: Buffer, resultJson: string): string {
  return createHmac("sha256", SECRET).update(`${deliveryId}|${sha256(photo)}|${sha256(resultJson)}`).digest("hex");
}

export function verifyCheck(deliveryId: string, photo: Buffer, resultJson: string, token: string): boolean {
  const want = Buffer.from(signCheck(deliveryId, photo, resultJson), "hex");
  const got = Buffer.from(token, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}
