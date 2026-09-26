import { toReceipt } from "../../../../lib/receipt";
import { getDelivery } from "../../../../lib/store";

export const runtime = "nodejs";

// The open receipt as JSON (format delivery-receipt/v1, see docs/receipt.schema.json).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const d = await getDelivery((await params).id);
  const receipt = d ? toReceipt(d, new URL(req.url).origin) : null;
  if (!receipt) return Response.json({ error: "No shared proof for this delivery yet" }, { status: 404 });
  return Response.json(receipt, { headers: { "Access-Control-Allow-Origin": "*" } });
}
