import { timingSafeEqual } from "crypto";
import { parseLatLon } from "../../../../lib/geo";
import { normalizePhoto } from "../../../../lib/photo";
import { CALLS_PER_CHECK } from "../../../../lib/nebius";
import { runVerification } from "../../../../lib/pipeline";
import { preflight, recordCalls } from "../../../../lib/store";
import type { NeedItem } from "../../../../lib/types";
import { complete, genuine } from "../../../../lib/verified";

export const runtime = "nodejs";
export const maxDuration = 300;

// Server-to-server API for platforms (for example Givelink) to check a delivery photo.
// Stateless: nothing is stored here. The caller keeps its own photo fingerprints and sends them
// back as knownHashes, so reused photos are caught across its whole history. Docs: docs/api.md.

function authorized(req: Request): boolean {
  const keys = (process.env.VDC_API_KEYS || "").split(",").map((k) => k.trim()).filter(Boolean);
  const got = Buffer.from((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  return keys.some((k) => {
    const want = Buffer.from(k);
    return want.length === got.length && timingSafeEqual(want, got);
  });
}

export async function POST(req: Request) {
  if (!process.env.VDC_API_KEYS) return Response.json({ error: "API is not enabled on this server" }, { status: 503 });
  if (!authorized(req)) return Response.json({ error: "Invalid API key" }, { status: 401 });
  // Stateless, so only the model key matters here. Never answer a platform with a simulated verdict.
  if (!process.env.NEBIUS_API_KEY) return Response.json({ error: "The AI models aren't connected on this server (NEBIUS_API_KEY)." }, { status: 503 });

  const form = await req.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File) || !/^image\/(jpeg|png|webp)$/.test(photo.type)) {
    return Response.json({ error: "photo: a JPG, PNG or WEBP file is required" }, { status: 400 });
  }
  let items: NeedItem[];
  let knownHashes: { hash: string; id: string }[] = [];
  try {
    items = (JSON.parse(String(form.get("items") || "[]")) as NeedItem[]).map((i) => ({
      name: String(i.name).slice(0, 200),
      quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
      unit: String(i.unit || "units").slice(0, 40),
      price: i.price === undefined ? undefined : Number(i.price),
      image: typeof i.image === "string" && /^https:\/\//.test(i.image) ? i.image.slice(0, 500) : undefined,
    }));
    knownHashes = JSON.parse(String(form.get("knownHashes") || "[]"));
  } catch {
    return Response.json({ error: "items and knownHashes must be JSON arrays" }, { status: 400 });
  }
  if (!items.length || items.length > 50) return Response.json({ error: "items: send 1 to 50 products" }, { status: 400 });

  const { callsLeftToday } = await preflight();
  if (callsLeftToday < CALLS_PER_CHECK) return Response.json({ error: "Today's model call limit is reached. It resets at midnight UTC." }, { status: 429 });
  const raw = Buffer.from(await photo.arrayBuffer());
  const deliveryId = String(form.get("deliveryId") || "") || undefined;
  try {
    const result = await runVerification(
      {
        id: deliveryId,
        requestText: String(form.get("context") || "In-kind donation delivery").slice(0, 2000),
        items,
        orgName: String(form.get("orgName") || "").slice(0, 200),
        city: String(form.get("city") || "").slice(0, 100),
        donorNames: [],
        photo: await normalizePhoto(raw),
        original: raw,
        seen: knownHashes.slice(-5000).map((h) => ({ hash: String(h.hash), id: String(h.id), at: "" })),
        orgAt: parseLatLon(form.get("orgLat"), form.get("orgLon")),
        orderCode: String(form.get("orderCode") || "") || undefined,
        uploadAt: parseLatLon(form.get("uploadLat"), form.get("uploadLon")),
      },
      () => {},
    );
    await recordCalls(result.usage?.length ?? 0).catch(() => {});
    const { vision: v, integrity: i, decision } = result;
    return Response.json({
      verdict: decision.verdict, // approve: complete · review: genuine but partial or uncertain · reject: not genuine or shows none of it
      genuine: genuine(result),
      complete: complete(result),
      score: decision.score,
      reasons: decision.reasons,
      nextAction: decision.nextAction,
      items: v.itemChecks,
      checks: {
        aiContentLabel: i.aiLabel,
        reusedPhotoOf: i.duplicateOf,
        visualAiSigns: v.aiSuspicion,
        cameraTimestamp: i.photoTakenAt,
        // For the platform's admin only. Don't publish: these place the nonprofit.
        photoDistanceKm: i.location.photoKm,
        uploadDistanceKm: i.location.uploadKm,
      },
      notes: i.notes,
      packingSlip: v.slip ?? null,
      cost: result.cost ?? null,
      photoHash: i.hash, // store this and send it back in knownHashes next time
      thankYouDraft: result.impact.donorMessage || null,
      models: result.models ?? null,
      visionModel: v.model ?? null, // the fallback, if the primary vision model timed out
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
