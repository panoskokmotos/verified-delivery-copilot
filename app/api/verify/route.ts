import sharp from "sharp";
import { runVerification, type VerifyInput } from "../../../lib/pipeline";
import { getDelivery, preflight, saveVerification } from "../../../lib/store";
import type { StepEvent } from "../../../lib/types";

export const runtime = "nodejs";
// The vision model sometimes takes 30 to 45s under load, so leave headroom.
export const maxDuration = 120;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) return Response.json({ error: "Missing photo" }, { status: 400 });
  if (photo.size > MAX_BYTES) return Response.json({ error: "Photo is over 8 MB" }, { status: 413 });
  if (!/^image\/(jpeg|png|webp)$/.test(photo.type)) return Response.json({ error: "Use a JPG, PNG or WEBP photo" }, { status: 415 });
  // Browsers shrink large photos before upload (the platform caps requests at 4.5 MB) and send
  // the original's metadata header alongside, so camera data and AI labels still get checked.
  const meta = form.get("meta");

  const deliveryId = String(form.get("deliveryId") || "");
  const delivery = deliveryId ? await getDelivery(deliveryId) : null;
  if (deliveryId && !delivery) return Response.json({ error: "Unknown delivery" }, { status: 404 });
  if (delivery?.status === "approve") return Response.json({ error: "This delivery is already confirmed" }, { status: 409 });

  const { seen, budgetLeft } = await preflight();
  if (delivery && budgetLeft <= 0) {
    return Response.json({ error: "This month's verification limit is reached. It resets on the 1st." }, { status: 429 });
  }

  const raw = Buffer.from(await photo.arrayBuffer());
  const normalized = await sharp(raw).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();

  const input: VerifyInput = delivery
    ? {
        id: delivery.id,
        requestText: delivery.requestText,
        items: delivery.items,
        orgName: delivery.orgName,
        city: delivery.city,
        donorName: delivery.donorName,
        photo: normalized,
        original: meta instanceof File ? Buffer.from(await meta.arrayBuffer()) : raw,
        seen,
      }
    : {
        // Free-form check (the /try page and the eval script). Nothing is saved.
        requestText: String(form.get("requestText") || "").slice(0, 2000),
        orgName: String(form.get("orgName") || "").slice(0, 200),
        city: String(form.get("city") || "").slice(0, 100),
        donorName: String(form.get("donorName") || "").slice(0, 100),
        photo: normalized,
        original: meta instanceof File ? Buffer.from(await meta.arrayBuffer()) : raw,
        seen,
      };
  if (!input.requestText) return Response.json({ error: "Describe what the nonprofit asked for" }, { status: 400 });

  // Stream each agent step to the UI as newline-delimited JSON.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: StepEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        const result = await runVerification(input, emit);
        if (delivery) {
          const now = new Date().toISOString();
          await saveVerification({ ...delivery, status: result.decision.verdict, updatedAt: now, result }, normalized);
        }
        emit({ type: "final", result });
      } catch (err) {
        emit({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
