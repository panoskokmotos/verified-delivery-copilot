import { missingSettings } from "../../../lib/config";
import { tavilyEnabled } from "../../../lib/tavily";
import { isLive, models } from "../../../lib/nebius";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ mode: isLive() ? "live" : "demo", missing: missingSettings(), models, productLookups: tavilyEnabled() });
}
