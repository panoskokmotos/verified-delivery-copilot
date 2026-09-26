import type { Delivery, ItemCheck, NeedItem } from "./types";

/** Every product in a delivery, with quantities summed across donors. */
export function allItems(d: Delivery): NeedItem[] {
  const byName = new Map<string, NeedItem>();
  for (const don of d.donations) {
    for (const it of don.items) {
      const cur = byName.get(it.name);
      byName.set(it.name, cur ? { ...cur, quantity: cur.quantity + it.quantity } : { ...it });
    }
  }
  return [...byName.values()];
}

export const itemCount = (items: NeedItem[]) => items.reduce((a, i) => a + i.quantity, 0);
export const itemValue = (items: NeedItem[]) => items.reduce((a, i) => a + i.quantity * (i.price ?? 0), 0);

/** One donor's items matched to the photo check: "you gave 2 of these 4". */
export function donorShare(d: Delivery, donorId: string): { item: NeedItem; check?: ItemCheck; total: number }[] {
  const mine = d.donations.find((x) => x.donorId === donorId)?.items ?? [];
  const totals = allItems(d);
  return mine.map((item) => ({
    item,
    check: d.result?.vision.itemChecks.find((c) => c.name === item.name),
    total: totals.find((t) => t.name === item.name)?.quantity ?? item.quantity,
  }));
}
