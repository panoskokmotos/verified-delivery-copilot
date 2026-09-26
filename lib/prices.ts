// USD per 1M tokens, [input, output], for the cost shown on each check.
// Token Factory prices sit behind the account login, so the defaults below are only the ones with a
// public source. Set the rest from your pricing page:
//   NEBIUS_PRICES={"nvidia/nemotron-3-super-120b-a12b":[0.3,0.8], ...}
const PUBLIC: Record<string, [number, number]> = {
  "google/gemma-3-27b-it": [0.1, 0.3], // getmaxim.ai Nebius cost calculator, Sept 2026
};

function table(): Record<string, [number, number]> {
  try {
    return { ...PUBLIC, ...JSON.parse(process.env.NEBIUS_PRICES || "{}") };
  } catch {
    return PUBLIC;
  }
}

export type Usage = { model: string; input: number; output: number };
export type Cost = { usd: number | null; tokens: number; unpriced: string[] }; // usd null if any model has no price

export function costOf(usage: Usage[]): Cost {
  const prices = table();
  let usd = 0;
  const unpriced = new Set<string>();
  for (const u of usage) {
    const p = prices[u.model];
    if (!p) unpriced.add(u.model);
    else usd += (u.input * p[0] + u.output * p[1]) / 1_000_000;
  }
  return {
    usd: unpriced.size ? null : Math.round(usd * 1_000_000) / 1_000_000,
    tokens: usage.reduce((a, u) => a + u.input + u.output, 0),
    unpriced: [...unpriced],
  };
}
