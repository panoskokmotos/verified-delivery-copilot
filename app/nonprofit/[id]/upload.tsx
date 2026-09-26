"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { allItems } from "../../../lib/items";
import type { Delivery } from "../../../lib/types";
import { Camera, type Shot } from "../../camera";
import { Products } from "../../products";
import { Questions } from "../../questions";
import { CheckCost, StepList, Verdict, useVerify } from "../../verify-ui";

export function Upload({ delivery }: { delivery: Delivery }) {
  const [shot, setShot] = useState<Shot | null>(null);
  const [note, setNote] = useState("");
  const { steps, result, error, busy, run, confirm, canConfirm, confirmed } = useVerify();
  const last = result ?? delivery.result;
  const done = confirmed || delivery.status === "approve";
  const checking = busy && !result;
  const n = delivery.donations.length;
  const onShot = useCallback((s: Shot | null) => setShot(s), []);

  // When the photo checks out, start the thank-you note from the model's draft. The nonprofit edits it.
  useEffect(() => {
    if (canConfirm && result?.impact.donorMessage) setNote(result.impact.donorMessage);
  }, [canConfirm, result]);

  const check = () => shot && run(shot, { deliveryId: delivery.id });

  return (
    <div className="grid">
      <section className="card">
        <h2>Products in this delivery</h2>
        <div className="donors">
          {delivery.donations.map((d) => (
            <span key={d.donorId} className="pill">{d.donorName} · {d.items.reduce((a, i) => a + i.quantity, 0)} items</span>
          ))}
        </div>
        <Products items={allItems(delivery)} />

        {done ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="viewfinder" style={{ marginTop: 14 }} src={`/api/photo/${delivery.id}?v=${delivery.updatedAt ?? ""}`} alt="Delivery proof" />
            <p className="ok">Proof shared with {n} donors. Each sees this photo and their own items, checked.</p>
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 18 }}>Upload delivery proof</h2>
            <Camera onShot={onShot} disabled={busy} />
            {shot && (!result || !canConfirm) && (
              <button className="btn primary block" disabled={busy} onClick={check}>
                {checking ? "Checking every item…" : result ? "Check this photo" : "Check photo"}
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
            Before any donor sees it, you see what we see: every product in this delivery, ticked when the photo shows it. Nothing is
            shared until you send it.
          </p>
        )}
        {last && <Verdict result={last} />}
        {canConfirm && (
          <>
            <label htmlFor="note">Thank-you note to all {n} donors</label>
            <textarea id="note" className="note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What do these items unlock for your work?" />
            <p className="sub">We drafted this from your photo. Make it yours.</p>
            <button className="btn gradient block" disabled={busy || !note.trim()} onClick={() => confirm(delivery.id, note)}>
              {busy ? "Sending…" : result?.decision.verdict === "review" ? `Send as is to all ${n} donors` : `Send proof to all ${n} donors`}
            </button>
          </>
        )}
        {done && (
          <p className="sub" style={{ marginTop: 12 }}>
            <Link href={`/proof/${delivery.id}`}>See the public receipt →</Link>
          </p>
        )}
        {last && <CheckCost result={last} />}
        <details className="how" open={checking}>
          <summary>What the agent did</summary>
          <StepList steps={steps} />
        </details>
      </section>

      {done && (
        <section className="card" style={{ gridColumn: "1 / -1" }}>
          <h2>Questions from donors</h2>
          <Questions delivery={delivery} as="nonprofit" />
        </section>
      )}
    </div>
  );
}
