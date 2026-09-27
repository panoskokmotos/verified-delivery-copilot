import { randomBytes } from "crypto";
import { getDelivery, updateDelivery } from "../../../lib/store";

export const runtime = "nodejs";

// Donors ask the nonprofit a question about a delivery; the nonprofit answers. Each is one storage write,
// so questions are capped, and they stop well before the month's write budget so checks never run out.
// The demo has no logins: on a real platform, asking needs the donor's session and answering the nonprofit's.
const MAX_OPEN_PER_DONOR = 3;
const MAX_PER_DELIVERY = 20;
const WRITES_KEPT_FOR_CHECKS = 200;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    deliveryId?: string;
    donorId?: string;
    text?: string;
    questionId?: string;
    answer?: string;
  };
  const d = body.deliveryId ? await getDelivery(body.deliveryId) : null;
  if (!d) return Response.json({ error: "Unknown delivery" }, { status: 404 });

  try {
    // The nonprofit answers.
    if (body.questionId) {
      const answer = String(body.answer || "").trim().slice(0, 1000);
      if (!answer) return Response.json({ error: "Write an answer first" }, { status: 400 });
      const q = d.questions?.find((x) => x.id === body.questionId);
      if (!q) return Response.json({ error: "Unknown question" }, { status: 404 });
      if (q.answer) return Response.json({ error: "Already answered" }, { status: 409 });
      await updateDelivery(
        d.id,
        (x) => ({
          ...x,
          questions: (x.questions ?? []).map((q) => (q.id === body.questionId ? { ...q, answer, answeredAt: new Date().toISOString() } : q)),
        }),
        { reserve: WRITES_KEPT_FOR_CHECKS },
      );
      return Response.json({ ok: true });
    }

    // A donor asks. Only donors whose gift is in this delivery.
    const donation = d.donations.find((x) => x.donorId === body.donorId);
    const text = String(body.text || "").trim().slice(0, 500);
    if (!donation) return Response.json({ error: "Only donors of this delivery can ask here" }, { status: 403 });
    if (!text) return Response.json({ error: "Write a question first" }, { status: 400 });
    const open = (d.questions ?? []).filter((q) => q.donorId === donation.donorId && !q.answer).length;
    if (open >= MAX_OPEN_PER_DONOR) return Response.json({ error: "Wait for an answer before asking more" }, { status: 429 });
    if ((d.questions ?? []).length >= MAX_PER_DELIVERY) return Response.json({ error: "This delivery has reached its question limit" }, { status: 429 });
    await updateDelivery(
      d.id,
      (x) => ({
        ...x,
        questions: [
          ...(x.questions ?? []),
          { id: randomBytes(6).toString("hex"), donorId: donation.donorId, donorName: donation.donorName, text, askedAt: new Date().toISOString() },
        ],
      }),
      { reserve: WRITES_KEPT_FOR_CHECKS },
    );
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: /limit/i.test(message) ? 429 : 500 });
  }
}
