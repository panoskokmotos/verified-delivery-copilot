import { normalizePhoto } from "../../../lib/photo";
import { sha256, verifyCheck } from "../../../lib/sign";
import { getDelivery, preflight, saveVerification } from "../../../lib/store";
import type { VerificationResult } from "../../../lib/types";

export const runtime = "nodejs";

// The nonprofit sends a checked photo to donors: complete, or genuine but partial. Same photo, same
// result, signed by /api/verify. Delivery status "approve" means the proof was shared; the result's
// own verdict still says whether every item showed.
export async function POST(req: Request) {
  const form = await req.formData();
  const photo = form.get("photo");
  const deliveryId = String(form.get("deliveryId") || "");
  const resultJson = String(form.get("result") || "");
  const token = String(form.get("confirmToken") || "");
  // The nonprofit's own thank-you note, sent with the proof. Not part of the signed check.
  const note = String(form.get("note") || "").trim().slice(0, 1500);
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
  const normalized = await normalizePhoto(raw);
  await saveVerification(
    { ...delivery, status: "approve", updatedAt: new Date().toISOString(), result, thankYouNote: note, photoSha256: sha256(normalized) },
    normalized,
  );
  return Response.json({ ok: true });
}
