import { allItems, itemValue } from "./items";
import type { Delivery } from "./types";
import { complete, verified } from "./verified";

// Open impact data: what got delivered and proven, by cause. No donor names.

export type Stats = {
  deliveries: number;
  proofsShared: number;
  complete: number; // every product visible
  partial: number; // genuine photo, some products not visible
  unverified: number; // sent by the nonprofit without passing the check; proves nothing
  fakesStopped: number; // AI-labeled, reused or visibly AI photos, rejected
  waitingForProof: number;
  itemsProven: number; // units visible in shared proof, capped at what was given
  valueProven: number; // USD
  medianDaysToProof: number | null; // from arrival to shared proof
  byCause: { cause: string; deliveries: number; itemsProven: number; valueProven: number }[];
};

const shared = (d: Delivery) => d.status === "approve" && Boolean(d.result);
const fake = (d: Delivery) =>
  d.status === "reject" && Boolean(d.result && (d.result.integrity.aiLabel === "generated" || d.result.integrity.duplicateOf || d.result.vision.aiSuspicion === "strong"));

function proven(d: Delivery) {
  const items = allItems(d);
  let units = 0;
  let value = 0;
  if (!d.result || !verified(d.result)) return { units, value }; // an unverified photo proves nothing
  for (const c of d.result?.vision.itemChecks ?? []) {
    const n = Math.min(c.seen ?? (c.status === "seen" ? c.expected : 0), c.expected);
    units += n;
    value += n * (items.find((i) => i.name === c.name)?.price ?? 0);
  }
  return { units, value };
}

export function computeStats(all: Delivery[]): Stats {
  const done = all.filter(shared);
  const days = done
    .map((d) => (new Date(d.updatedAt!).getTime() - new Date(d.arrivesAt).getTime()) / 86_400_000)
    .filter((n) => n >= 0)
    .sort((a, b) => a - b);
  const causes = [...new Set(all.map((d) => d.cause))];
  return {
    deliveries: all.length,
    proofsShared: done.length,
    complete: done.filter((d) => verified(d.result!) && complete(d.result!)).length,
    partial: done.filter((d) => verified(d.result!) && !complete(d.result!)).length,
    unverified: done.filter((d) => !verified(d.result!)).length,
    fakesStopped: all.filter(fake).length,
    waitingForProof: all.filter((d) => d.status !== "approve" && d.status !== "shipping").length,
    itemsProven: done.reduce((a, d) => a + proven(d).units, 0),
    valueProven: Math.round(done.reduce((a, d) => a + proven(d).value, 0)),
    medianDaysToProof: days.length ? Math.round(days[Math.floor(days.length / 2)] * 10) / 10 : null,
    byCause: causes.map((cause) => {
      const ds = done.filter((d) => d.cause === cause);
      return {
        cause,
        deliveries: all.filter((d) => d.cause === cause).length,
        itemsProven: ds.reduce((a, d) => a + proven(d).units, 0),
        valueProven: Math.round(ds.reduce((a, d) => a + proven(d).value, 0)),
      };
    }),
  };
}

/** One row per delivery, for researchers and funders. */
export function statsCsv(all: Delivery[]): string {
  const head = ["delivery_id", "cause", "city", "supplier", "arrived", "status", "donors", "items_given", "value_given_usd", "items_proven", "value_proven_usd", "complete", "passed_check", "ai_label", "reused_photo", "proof_shared_at"];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = all.map((d) => {
    const items = allItems(d);
    const p = proven(d);
    const r = d.result;
    return [
      d.id, d.cause, d.city, d.supplier, d.arrivesAt,
      d.status === "approve" ? "proof_shared" : d.status,
      d.donations.length, items.reduce((a, i) => a + i.quantity, 0), itemValue(items),
      shared(d) ? p.units : "", shared(d) ? Math.round(p.value) : "",
      r ? complete(r) : "",
      shared(d) ? verified(r!) : "",
      r?.integrity.aiLabel ?? "", r ? Boolean(r.integrity.duplicateOf) : "",
      shared(d) ? d.updatedAt : "",
    ].map(esc).join(",");
  });
  return [head.join(","), ...rows].join("\n") + "\n";
}
