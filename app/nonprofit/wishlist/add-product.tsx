"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Add a product by pasting its link from any shop, or typing its name. */
export function AddProduct({ orgId }: { orgId: string }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  async function add() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/wishlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", orgId, url, name, quantity: qty }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: j.error || "Couldn't add it" });
    setUrl("");
    setName("");
    setMsg({ ok: true, text: j.recall === "found" ? "Added, but a recall notice matches it. Donors can't give it." : "Added. No recalls found." });
    router.refresh();
  }

  return (
    <div>
      <label htmlFor="url">Product link</label>
      <input id="url" type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.amazon.com/…" />
      <label htmlFor="pname">Product name (needed for Amazon links, which can&apos;t be read)</label>
      <input id="pname" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Graco TurboBooster car seat" />
      <div className="give" style={{ marginTop: 12 }}>
        <label htmlFor="qty" style={{ margin: 0 }}>How many</label>
        <input id="qty" type="number" min={1} max={500} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} />
        <button className="btn primary" disabled={busy || (!url.trim() && !name.trim())} onClick={add}>
          {busy ? "Looking it up…" : "Add to wishlist"}
        </button>
      </div>
      {busy && <p className="sub">Reading the product page and searching US CPSC, SaferProducts.gov and the EU Safety Gate for recalls. About 10 seconds.</p>}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
    </div>
  );
}
