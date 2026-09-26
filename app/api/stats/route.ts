import { computeStats, statsCsv } from "../../../lib/stats";
import { listDeliveries } from "../../../lib/store";

export const runtime = "nodejs";

// Open impact data. JSON by default, one row per delivery with ?format=csv.
export async function GET(req: Request) {
  const all = await listDeliveries();
  const cors = { "Access-Control-Allow-Origin": "*" };
  if (new URL(req.url).searchParams.get("format") === "csv") {
    return new Response(statsCsv(all), {
      headers: { ...cors, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="deliveries.csv"' },
    });
  }
  return Response.json(computeStats(all), { headers: cors });
}
