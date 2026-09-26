import sharp from "sharp";
import { verifyCheck } from "../../../lib/sign";
import { getDelivery, preflight, saveVerification } from "../../../lib/store";
import type { VerificationResult } from "../../../lib/types";

export const runtime = "nodejs";

// The nonprofit confirms an approved check. Same photo, same result, signed by /api/verify.
export async function POST(req: Request) {
  const form = await req.formData();
  const photo = form.get("photo");
  const deliveryId = String(form.get("deliveryId") || "");
  const resultJson = String(form.get("result") || "");
  const token = String(form.get("confirmToken") || "");
  if (!(photo instanceof File) || !deliveryId || !resultJson || !token) return Response.json({ error: "Missing fields" }, { status: 400 });

  const raw = Buffer.from(await photo.arrayBuffer());
  if (!verifyCheck(deliveryId, raw, resultJson, token)) {
    return Response.json({ error: "This check expired or doesn't match the photo. Please check the photo again." }, { status: 403 });
  }
  const delivery = await getDelivery(deliveryId);
  if (!delivery) return Response.json({ error: "Unknown delivery" }, { status: 404 });
  if (delivery.status === "approve") return Response.json({ error: "This delivery is already confirmed" }, { status: 409 });
  if ((await preflight()).budgetLeft <= 0) return Response.json({ error: "This month's verification limit is reached. It resets on the 1st." }, { status: 429 });

  const result = JSON.parse(resultJson) as VerificationResult;
  const normalized = await sharp(raw).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  await saveVerification({ ...delivery, status: "approve", updatedAt: new Date().toISOString(), result }, normalized);
  return Response.json({ ok: true });
}
