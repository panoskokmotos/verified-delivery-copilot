import { recordTavily, tavilyLeftToday } from "./store";

// Tavily web search, used only when a nonprofit adds a product to its wishlist: read the product page
// (name, official photo) and search recall databases. Every call is capped twice: a shared daily count
// in storage (TAVILY_MAX_CALLS_PER_DAY) and a stop before the plan's monthly credits run out
// (TAVILY_CREDIT_RESERVE left untouched), read from Tavily's free /usage endpoint.

const BASE = "https://api.tavily.com";
const RESERVE = Number(process.env.TAVILY_CREDIT_RESERVE || 100);

export const tavilyEnabled = () => Boolean(process.env.TAVILY_API_KEY);

const headers = () => ({ Authorization: `Bearer ${process.env.TAVILY_API_KEY}`, "Content-Type": "application/json" });

/** Throws when today's cap or the month's credits would be exceeded by `calls` more calls. */
async function allow(calls: number) {
  if (!tavilyEnabled()) throw new Error("Product lookups aren't set up on this site (TAVILY_API_KEY).");
  if ((await tavilyLeftToday()) < calls) throw new Error("Today's product lookup limit is reached. It resets at midnight UTC.");
  const res = await fetch(`${BASE}/usage`, { headers: headers(), signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error("Couldn't confirm the product lookup budget. Try again later.");
  const u = (await res.json()) as { account?: { plan_usage?: number; plan_limit?: number | null } };
  const used = u.account?.plan_usage ?? 0;
  const limit = u.account?.plan_limit;
  if (limit && used + calls > limit - RESERVE) throw new Error("This month's product lookup credits are used up.");
}

async function call<T>(path: string, body: object): Promise<T> {
  await allow(1);
  await recordTavily(1);
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Product lookup failed (${res.status})`);
  return (await res.json()) as T;
}

export type SearchResult = { title: string; url: string; content: string };

export function search(query: string, opts: { domains?: string[]; images?: boolean; max?: number } = {}) {
  return call<{ results: SearchResult[]; images?: (string | { url: string })[] }>("/search", {
    query,
    search_depth: "basic",
    max_results: opts.max ?? 5,
    include_images: Boolean(opts.images),
    ...(opts.domains ? { include_domains: opts.domains } : {}),
  });
}

export function extract(url: string) {
  return call<{ results: { url: string; raw_content: string; images?: string[] }[]; failed_results?: unknown[] }>("/extract", {
    urls: [url],
    include_images: true,
    extract_depth: "basic",
  });
}
