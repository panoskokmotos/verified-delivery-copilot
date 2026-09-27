import { askJson, isLive, models } from "./nebius";
import { extract, search, type SearchResult } from "./tavily";
import type { Recall } from "./types";

// When a nonprofit adds a product to its wishlist: find its name and official photo, then look for
// recalls of that exact product. 2 Tavily calls and 1 Nemotron call per new product; results are cached.

const RECALL_SOURCES = ["cpsc.gov", "saferproducts.gov", "ec.europa.eu"]; // US CPSC, its public database, EU Safety Gate
const SOURCE_NAMES = ["US CPSC", "SaferProducts.gov", "EU Safety Gate"];

export type Product = { name: string; image?: string; url?: string; price?: number };

/** The cache key for a product: its page without tracking parameters, or its name. */
export function productKey(url: string | undefined, name: string | undefined): string {
  if (url) {
    const u = new URL(url);
    return `url:${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/ref=.*$/, "")}`.toLowerCase();
  }
  return `name:${(name ?? "").trim().toLowerCase().replace(/\s+/g, " ")}`;
}

const firstImage = (images?: (string | { url: string })[]) => {
  const urls = (images ?? []).map((i) => (typeof i === "string" ? i : i.url)).filter((u) => /^https:\/\//.test(u));
  return urls.find((u) => /\.(jpe?g|png|webp)(\?|$)/i.test(u)) ?? urls[0];
};

/** Name, photo and price from the product page; or, with only a name, from a web search. */
export async function lookupProduct(url: string | undefined, name: string | undefined): Promise<Product> {
  // Amazon always blocks page reading, so don't spend a call trying.
  const blocked = url ? /(^|\.)amazon\./i.test(new URL(url).hostname) : false;
  if (url && !blocked) {
    const page = (await extract(url)).results?.[0];
    const text = page?.raw_content ?? "";
    const title = name || text.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find((l) => l.length > 8 && l.length < 200);
    if (title) {
      const price = Number(text.match(/\$\s?(\d{1,4}(?:\.\d{2})?)/)?.[1]);
      return { name: title.slice(0, 160), image: firstImage(page?.images), url, price: Number.isFinite(price) && price > 0 ? price : undefined };
    }
  }
  // A page we can't read gives no reliable name, and a recall check on the wrong name is worse than none.
  if (!name) throw new Error(blocked ? "Amazon doesn't let us read its pages. Type the product name too." : "Couldn't read that product page. Type the product name too.");
  const r = await search(`${name} product`, { images: true, max: 3 });
  return { name: name.slice(0, 160), image: firstImage(r.images), url: url ?? r.results[0]?.url };
}

/** Searches recall databases, then Nemotron decides whether any notice is about this exact product. */
export async function checkRecall(productName: string): Promise<Recall> {
  const { results } = await search(`${productName} recall`, { domains: RECALL_SOURCES, max: 5 });
  const checkedAt = new Date().toISOString();
  const searched = SOURCE_NAMES;
  if (!results.length) return { status: "clear", checkedAt, summary: "No recall notices found for this product.", source: null, searched };
  const hits: SearchResult[] = results.map((r) => ({ title: r.title, url: r.url, content: r.content.slice(0, 500) }));
  if (!isLive()) return { status: "clear", checkedAt, summary: "Recall notices exist for similar products; none checked against this one (demo mode).", source: null, searched };
  const v = await askJson<{ recalled: boolean; url: string | null; summary: string }>({
    model: models.reasoning,
    think: false,
    maxTokens: 300,
    system:
      "You check product safety for a donation platform. Given a product and search results from recall databases, decide if any result " +
      "is a recall of this same product (same brand and product line; a different brand or unrelated product does not count). " +
      'Return {"recalled": boolean, "url": the matching result url or null, "summary": one plain sentence}.',
    user: JSON.stringify({ product: productName, results: hits }),
  });
  // A recall counts only with a notice we actually found; the model can't invent a source.
  const source = v.recalled ? hits.find((h) => h.url === v.url) : undefined;
  return source
    ? { status: "found", checkedAt, summary: v.summary, source: { title: source.title, url: source.url }, searched }
    : { status: "clear", checkedAt, summary: "No recall notice matches this product.", source: null, searched };
}
