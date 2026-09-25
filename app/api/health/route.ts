import { isLive, models } from "../../../lib/nebius";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ mode: isLive() ? "live" : "demo", models, tavily: Boolean(process.env.TAVILY_API_KEY) });
}
