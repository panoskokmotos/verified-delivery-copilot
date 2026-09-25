import type { OrgCheck } from "./types";

/** Confirms the receiving nonprofit exists and is active, using Tavily web search. */
export async function checkOrg(orgName: string, city: string): Promise<OrgCheck> {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !orgName.trim()) {
    return { ran: false, found: false, summary: "Skipped (no Tavily key or no org name).", sources: [] };
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
  const json = (await res.json()) as { answer?: string; results?: { title: string; url: string }[] };
  const sources = (json.results || []).slice(0, 3).map((r) => ({ title: r.title, url: r.url }));
  const name = orgName.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const found = sources.some((s) => name.some((w) => s.title.toLowerCase().includes(w)));
  return { ran: true, found, summary: json.answer || (found ? "Organization found on the web." : "No clear web match."), sources };
}
