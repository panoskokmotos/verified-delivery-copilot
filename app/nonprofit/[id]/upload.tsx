"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { allItems } from "../../../lib/items";
import type { Delivery } from "../../../lib/types";
import { Products } from "../../products";
import { StepList, Verdict, useVerify } from "../../verify-ui";

export function Upload({ delivery }: { delivery: Delivery }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  // Optional: where the phone is right now. Only a distance to the nonprofit's address is kept.
  const [shareLocation, setShareLocation] = useState(false);
  const [here, setHere] = useState<{ lat: number; lon: number } | null>(null);

  function toggleLocation(on: boolean) {
    setShareLocation(on);
    if (!on) return setHere(null);
    navigator.geolocation?.getCurrentPosition(
      (p) => setHere({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setShareLocation(false),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }
  const fields = () => ({ deliveryId: delivery.id, ...(here ? { uploadLat: String(here.lat), uploadLon: String(here.lon) } : {}) });
  const inputRef = useRef<HTMLInputElement>(null);
  const { steps, result, error, busy, run, confirm, canConfirm, confirmed } = useVerify();
  const last = result ?? delivery.result;
  const done = confirmed || delivery.status === "approve";
  const checking = busy && !result;
  const n = delivery.donations.length;

  // When the photo checks out, start the thank-you note from the model's draft. The nonprofit edits it.
  useEffect(() => {
    if (canConfirm && result?.impact.donorMessage) setNote(result.impact.donorMessage);
  }, [canConfirm, result]);

  function pick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

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
          <p className="ok">Proof shared with {n} donors. Each sees the photo and their own items, checked.</p>
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
                    <li>Only people who agreed to be in it</li>
                  </ul>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            <label className="check">
              <input type="checkbox" checked={shareLocation} onChange={(e) => toggleLocation(e.target.checked)} />
              Add my location to this proof <span className="sub">(only the distance to your address is kept)</span>
            </label>
            {!result && (
              <button className="btn primary block" disabled={busy || !file} onClick={() => file && run(file, fields())}>
                {checking ? "Checking every item…" : "Check photo"}
              </button>
            )}
            {result && (!canConfirm || result.decision.verdict === "review") && (
              <>
                <button className="btn secondary block" onClick={() => inputRef.current?.click()} disabled={busy}>
                  {result.decision.verdict === "review" ? "Retake to show everything" : "Retake or choose another photo"}
                </button>
                {file && (
                  <button className="btn subtle block" disabled={busy} onClick={() => run(file, fields())}>Check this photo</button>
                )}
              </>
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
        <details className="how" open={checking}>
          <summary>What the agent did</summary>
          <StepList steps={steps} />
        </details>
      </section>
    </div>
  );
}
