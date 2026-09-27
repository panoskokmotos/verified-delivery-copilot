import { randomBytes } from "crypto";
import { DONORS, ORGS } from "../../../lib/demo";
import { checkRecall, lookupProduct, productKey } from "../../../lib/products";
import { addWishItem, cachedProduct, giveFromWishlist, listWishlists, recordCalls } from "../../../lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return Response.json(await listWishlists());
}

// A nonprofit adds a product (a link or a name); a donor gives from a wishlist.
// The demo has no logins: on a real platform adding needs the nonprofit's session and giving a payment.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: "add" | "give";
    orgId?: string;
    url?: string;
    name?: string;
    quantity?: number;
    itemId?: string;
    donorId?: string;
  };
  const org = ORGS.find((o) => o.id === body.orgId);
  if (!org) return Response.json({ error: "Unknown nonprofit" }, { status: 404 });
  const quantity = Math.floor(Number(body.quantity) || 0);

  try {
    if (body.action === "give") {
      const donorName = DONORS[body.donorId ?? ""];
      if (!donorName) return Response.json({ error: "Pick who is giving" }, { status: 400 });
      const deliveryId = await giveFromWishlist(org.id, String(body.itemId), body.donorId!, donorName, quantity);
      return Response.json({ ok: true, deliveryId });
    }

    // Add a product: a link (Amazon or any shop) or a plain name.
    let url: string | undefined;
    if (body.url?.trim()) {
      try {
        url = new URL(body.url.trim()).toString();
        if (!/^https?:$/.test(new URL(url).protocol)) throw new Error();
      } catch {
        return Response.json({ error: "That link doesn't look right" }, { status: 400 });
      }
    }
    const name = body.name?.trim().slice(0, 160) || undefined;
    if (!url && !name) return Response.json({ error: "Paste a product link or type its name" }, { status: 400 });
    if (quantity < 1 || quantity > 500) return Response.json({ error: "Quantity: 1 to 500" }, { status: 400 });

    // The same product looked up before costs nothing: reuse the name, photo and recall result.
    const key = productKey(url, name);
    const cached = await cachedProduct(key);
    let found = cached;
    if (!found) {
      const product = await lookupProduct(url, name);
      const recall = await checkRecall(product.name);
      await recordCalls(1).catch(() => {}); // the Nemotron call that judged the recall results
      found = { ...product, recall, at: recall.checkedAt };
    }
    await addWishItem(
      {
        id: randomBytes(5).toString("hex"),
        orgId: org.id,
        addedAt: new Date().toISOString(),
        given: 0,
        name: found.name,
        quantity,
        unit: "units",
        ...(found.price ? { price: found.price } : {}),
        ...(found.image ? { image: found.image } : {}),
        ...(found.url ? { url: found.url } : {}),
        recall: found.recall,
      },
      key,
    );
    return Response.json({ ok: true, cached: Boolean(cached), recall: found.recall.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: /limit|credits/i.test(message) ? 429 : 400 });
  }
}
