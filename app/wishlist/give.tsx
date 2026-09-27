"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Give some of a wishlist product, as one of the demo donors. */
export function Give({ orgId, itemId, left, donors, donor }: { orgId: string; itemId: string; left: number; donors: [string, string][]; donor?: string }) {
  const [who, setWho] = useState(donor ?? donors[0][0]);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const router = useRouter();

  async function give() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/wishlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "give", orgId, itemId, donorId: who, quantity: qty }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error || "Couldn't give");
    setDeliveryId(j.deliveryId);
    router.refresh();
  }

  if (deliveryId) {
    return (
      <p className="ok" style={{ marginTop: 8 }}>
        Thank you. It&apos;s on its way. <Link href={`/nonprofit/${deliveryId}`}>Be the nonprofit and send the proof →</Link> or{" "}
        <Link href={`/donor/${who}`}>follow it as the donor →</Link>
      </p>
    );
  }
  return (
    <div className="give">
      <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who is giving">
        {donors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      <input type="number" min={1} max={left} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(left, Number(e.target.value) || 1)))} aria-label="How many" />
      <button className="btn primary sm" disabled={busy} onClick={give}>{busy ? "Giving…" : "Give"}</button>
      {error && <span className="err">{error}</span>}
    </div>
  );
}
