import type { OrgCheck } from "./types";

// Words that say what kind of org it is, not which one. They match almost any charity.
const GENERIC = new Set([
  "the", "and", "for", "inc", "llc", "org", "foundation", "fund", "charity", "charities", "nonprofit",
  "association", "society", "center", "centre", "club", "clubs", "community", "services", "group",
  "helping", "hands", "hope", "home", "house", "project", "network", "alliance", "mission", "ministries",
]);

// Stop searching while this many credits are left, so the demo never runs the plan dry.
const RESERVE = Number(process.env.TAVILY_CREDIT_RESERVE || 100);

// One search per org per server run. Evals and retries reuse the answer instead of spending credits.
const cache = new Map<string, OrgCheck>();

/** Reads Tavily usage. This endpoint costs no credits. Returns credits left, or null if unknown. */
async function creditsLeft(key: string): Promise<number | null> {
  try {
    const res = await fetch("https://api.tavily.com/usage", { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    const { key: k, account } = (await res.json()) as {
      key?: { usage?: number; limit?: number | null };
      account?: { plan_usage?: number; plan_limit?: number | null };
    };
    const left = [
      k?.limit != null ? k.limit - (k.usage ?? 0) : Infinity,
      account?.plan_limit != null ? account.plan_limit - (account.plan_usage ?? 0) : Infinity,
    ];
    return Math.min(...left);
  } catch {
    return null;
  }
}

function words(s: string): string[] {
  return s.toLowerCase().replace(/&/g, " ").split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !GENERIC.has(w));
}

/** Confirms the receiving nonprofit exists and is active, using Tavily web search. */
export async function checkOrg(orgName: string, city: string): Promise<OrgCheck> {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !orgName.trim()) {
    return { ran: false, found: false, summary: "Skipped (no Tavily key or no org name).", sources: [] };
  }
  const cacheKey = `${orgName.trim().toLowerCase()}|${city.trim().toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const left = await creditsLeft(key);
  if (left === null || left <= RESERVE) {
    const why = left === null ? "could not read Tavily usage" : `${left} Tavily credits left`;
    return { ran: false, found: false, summary: `Skipped to protect the quota (${why}).`, sources: [] };
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query: `${orgName} ${city} nonprofit 501(c)(3) EIN`,
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
    }),
  });
  if (!res.ok) return { ran: true, found: false, summary: `Tavily error ${res.status}`, sources: [] };
  const json = (await res.json()) as { answer?: string; results?: { title: string; url: string; content?: string }[] };
  const results = json.results || [];

  // Found only if one result names every distinctive word of the org, e.g. "Nowhereville" in
  // "Sunshine Helping Hands Foundation of Nowhereville". Shared generic words are not enough.
  const need = words(orgName);
  const match = results.find((r) => {
    const text = new Set(words(`${r.title} ${r.content || ""}`));
    return need.length > 0 && need.every((w) => text.has(w));
  });
  const found = Boolean(match);
  const sources = (match ? [match, ...results.filter((r) => r !== match)] : results)
    .slice(0, 3)
    .map((r) => ({ title: r.title, url: r.url }));
  const summary = found
    ? json.answer || "Organization found on the web."
    : `No web result names this organization. Closest results may be a different org.`;
  const out = { ran: true, found, summary, sources };
  cache.set(cacheKey, out);
  return out;
}
