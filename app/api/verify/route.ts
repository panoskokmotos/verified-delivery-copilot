import { runVerification } from "../../../lib/pipeline";
import type { StepEvent } from "../../../lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) return Response.json({ error: "Missing photo" }, { status: 400 });
  if (photo.size > MAX_BYTES) return Response.json({ error: "Photo is over 8 MB" }, { status: 413 });
  if (!/^image\/(jpeg|png|webp)$/.test(photo.type)) return Response.json({ error: "Use a JPG, PNG or WEBP photo" }, { status: 415 });

  const input = {
    requestText: String(form.get("requestText") || "").slice(0, 2000),
    orgName: String(form.get("orgName") || "").slice(0, 200),
    city: String(form.get("city") || "").slice(0, 100),
    donorName: String(form.get("donorName") || "").slice(0, 100),
    photo: Buffer.from(await photo.arrayBuffer()),
    photoMime: photo.type,
    dryRun: form.get("dryRun") === "1",
  };
  if (!input.requestText) return Response.json({ error: "Describe what the nonprofit asked for" }, { status: 400 });

  // Stream each agent step to the UI as newline-delimited JSON.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: StepEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        const result = await runVerification(input, emit);
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
