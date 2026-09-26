"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Delivery } from "../../../lib/types";
import { StepList, Verdict, useVerify } from "../../verify-ui";

export function Upload({ delivery }: { delivery: Delivery }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { steps, result, error, busy, run } = useVerify();
  const last = result ?? delivery.result;
  const confirmed = (result?.decision.verdict ?? delivery.status) === "approve";

  function pick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>1 · What the donor sent</h2>
        <ul className="gift">
          {delivery.items.map((i, n) => (
            <li key={n}><strong>{i.quantity} {i.unit}</strong> · {i.name}</li>
          ))}
        </ul>
        <p className="sub">Your request: “{delivery.requestText}”</p>
        {confirmed ? (
          <p className="ok">Confirmed. The donor has their receipt.</p>
        ) : (
          <>
            <div className="drop" onClick={() => inputRef.current?.click()}>
              {preview ? <img src={preview} alt="Delivery photo" /> : "Tap to add one photo showing every item (JPG, PNG, WEBP)"}
            </div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            <button className="go" disabled={busy || !file} onClick={() => file && run(file, { deliveryId: delivery.id })}>
              {busy ? "Checking…" : delivery.result ? "Upload a new photo" : "Upload proof"}
            </button>
            {error && <p className="err">{error}</p>}
          </>
        )}
      </section>

      <section className="card">
        <h2>2 · The check</h2>
        <StepList steps={steps} />
        {last && <Verdict result={last} donorName={delivery.donorName} />}
        {confirmed && <p className="sub"><Link href="/donor">See it as the donor →</Link></p>}
      </section>
    </div>
  );
}
