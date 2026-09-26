// USD per 1M tokens, [input, output], for the cost shown on each check.
// Public Token Factory list prices (getmaxim.ai Nebius cost calculator, Sept 2026). Override any of them
// from your pricing page: NEBIUS_PRICES={"nvidia/nemotron-3-super-120b-a12b":[0.3,0.9], ...}
const PUBLIC: Record<string, [number, number]> = {
  "google/gemma-3-27b-it": [0.1, 0.3],
  "openbmb/MiniCPM-V-4_5": [0.66, 1.11],
  "nvidia/nemotron-3-super-120b-a12b": [0.3, 0.9],
  "nvidia/Nemotron-3-Ultra-550b-a55b": [1, 3],
  "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B": [0.06, 0.24],
};

/** Dollars at the precision a single check needs: $0.0031, not $0.00. */
export const usd = (n: number) => `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;

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
