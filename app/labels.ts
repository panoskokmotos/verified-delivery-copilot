import type { Delivery } from "../lib/types";

// Status wording, following the Givelink deliveries screens. The donor never sees a nonprofit's
// failed photo, only that the photo is still coming.
export const BAR: Record<Delivery["status"], string> = {
  shipping: "Shipping",
  awaiting_photo: "Arrived",
  review: "Arrived · retake needed",
  reject: "Arrived · photo not accepted",
  approve: "Completed",
};
export const DONOR_STATUS: Record<Delivery["status"], string> = {
  shipping: "Shipping",
  awaiting_photo: "Delivered · photo coming",
  review: "Delivered · photo coming",
  reject: "Delivered · photo coming",
  approve: "Delivered · proof checked",
};

/** A product picture stand-in: the demo has no product photos. */
export function productIcon(name: string): string {
  const n = name.toLowerCase();
  const map: [RegExp, string][] = [
    [/coat|jacket/, "🧥"], [/diaper/, "🧷"], [/wipe/, "🧻"], [/dog|cat|pet food/, "🐾"], [/blanket/, "🛏️"], [/notebook/, "📓"],
    [/pencil|pen\b/, "✏️"], [/backpack/, "🎒"], [/toilet|paper towel/, "🧻"], [/clean|ajax|soap/, "🧴"], [/food|rice|pasta|can/, "🥫"],
  ];
  return map.find(([r]) => r.test(n))?.[1] ?? "📦";
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const ago = (iso?: string) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
};
export const arrived = (d: Delivery) => d.status !== "shipping";
export const donorNames = (d: Delivery) => d.donations.map((x) => x.donorName);

/** A delivery's proof photo. The version changes with every new proof, so browsers never show an old one. */
export const photoUrl = (d: Delivery, download = false) =>
  `/api/photo/${d.id}?v=${encodeURIComponent(d.photoKey ?? d.updatedAt ?? "")}${download ? "&download=1" : ""}`;
