"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Delivery } from "../../../lib/types";
import { Products } from "../../products";
import { StepList, Verdict, useVerify } from "../../verify-ui";

export function Upload({ delivery }: { delivery: Delivery }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { steps, result, error, busy, run, confirm, canConfirm, confirmed } = useVerify();
  const last = result ?? delivery.result;
  const done = confirmed || delivery.status === "approve";
  const checking = busy && !result;

  function pick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>What the donor sent</h2>
        <Products items={delivery.items} />

        {done ? (
          <p className="ok">Proof shared. {delivery.donorName} can now see the photo and every checked item.</p>
        ) : (
          <>
            <h2 style={{ marginTop: 18 }}>Upload delivery proof</h2>
            <div className="drop" onClick={() => !busy && inputRef.current?.click()}>
              {preview ? (
                <img src={preview} alt="Delivery photo" />
              ) : (
                <>
                  Add a photo
                  <ul>
                    <li>All donated items, with labels readable</li>
                    <li>Taken where they arrived</li>
                    <li>Your sign or logo, if you can</li>
                  </ul>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            {!result && (
              <button className="btn primary block" disabled={busy || !file} onClick={() => file && run(file, { deliveryId: delivery.id })}>
                {checking ? "Checking every item…" : "Check photo"}
              </button>
            )}
            {result && !canConfirm && (
              <button className="btn secondary block" onClick={() => inputRef.current?.click()} disabled={busy}>
                Retake or choose another photo
              </button>
            )}
            {file && result && !canConfirm && (
              <button className="btn subtle block" disabled={busy} onClick={() => run(file, { deliveryId: delivery.id })}>
                Check this photo again
              </button>
            )}
            {error && <p className="err">{error}</p>}
          </>
        )}
      </section>

      <section className="card">
        <h2>{result ? "Your check" : last ? "Last check" : "How we check"}</h2>
        {!last && !checking && (
          <p className="sub">
            Before the donor sees anything, you see what we see: every item the donor sent, ticked when the photo shows it. Nothing is shared
            until you confirm.
          </p>
        )}
        {last && <Verdict result={last} donorName={delivery.donorName} />}
        {canConfirm && (
          <button className="btn gradient block" disabled={busy} onClick={() => confirm(delivery.id)}>
            {busy ? "Sending…" : `Confirm and send proof to ${delivery.donorName}`}
          </button>
        )}
        {done && <p className="sub" style={{ marginTop: 12 }}><Link href="/donor">See it as the donor →</Link></p>}
        <details className="how" open={checking}>
          <summary>What the agent did</summary>
          <StepList steps={steps} />
        </details>
      </section>
    </div>
  );
}
