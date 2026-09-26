import type { Delivery, NeedItem } from "../lib/types";

// Status wording for each side. The donor never sees a nonprofit's failed photo, only that proof is pending.
export const BAR: Record<Delivery["status"], string> = {
  awaiting_photo: "Arrived · needs proof",
  review: "Retake needed",
  reject: "Photo not accepted",
  approve: "Completed · proof shared",
};
export const NONPROFIT_STATUS: Record<Delivery["status"], string> = {
  awaiting_photo: "Photo needed",
  approve: "Confirmed",
  review: "Retake needed",
  reject: "Not accepted, try again",
};
export const DONOR_STATUS: Record<Delivery["status"], string> = {
  awaiting_photo: "Shipping",
  approve: "Delivered",
  review: "Delivered, confirming",
  reject: "Delivered, confirming",
};

/** A product picture stand-in: the demo has no product photos. */
export function productIcon(name: string): string {
  const n = name.toLowerCase();
  const map: [RegExp, string][] = [
    [/coat|jacket/, "🧥"], [/diaper/, "🧷"], [/dog|cat|pet/, "🐾"], [/notebook/, "📓"], [/pencil|pen\b/, "✏️"],
    [/backpack|bag\b/, "🎒"], [/toilet|paper towel/, "🧻"], [/clean|ajax|soap/, "🧴"], [/blanket/, "🛏️"], [/food|rice|pasta|can/, "🥫"],
  ];
  return map.find(([r]) => r.test(n))?.[1] ?? "📦";
}

export const itemsLine = (d: Delivery) => d.items.map((i) => `${i.quantity} × ${i.name}`).join(", ");
export const itemCount = (items: NeedItem[]) => items.reduce((a, i) => a + i.quantity, 0);
export const ago = (iso?: string) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
};
