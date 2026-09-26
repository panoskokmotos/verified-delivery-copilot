import { getDelivery, readPhoto } from "../../../../lib/store";

export const runtime = "nodejs";

// A delivery photo is shown to donors and the public only once the delivery is confirmed.
// Until then it stays private: it may show a mistake, a fake, or people who didn't agree to be seen.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const delivery = await getDelivery(id);
  if (!delivery || delivery.status !== "approve") return new Response("Not available", { status: 404 });
  const photo = await readPhoto(id);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, immutable" },
  });
}
