"use client";

import { useCallback, useState } from "react";
import { Camera, type Shot } from "../camera";
import { StepList, Verdict, useVerify } from "../verify-ui";

const SAMPLES = [
  { label: "Shelter: winter coats", requestText: "We need 40 new winter coats, adult sizes M to XL, for our overnight shelter before Dec 15.", orgName: "Northgate Family Shelter (demo)", city: "Oakland, CA", donorName: "Maria" },
  { label: "Pantry: diapers", requestText: "Food pantry needs 12 packs of size 4 diapers, sealed, any brand.", orgName: "Bluebell Community Pantry (demo)", city: "Austin, TX", donorName: "Acme Corp CSR team" },
  { label: "Animal rescue: dog food", requestText: "Please send 10 bags of dry dog food, 30 lb bags, unopened.", orgName: "Paws of Hope Rescue (demo)", city: "Los Angeles, CA", donorName: "Daniel" },
];

// Open tool: check any photo against any request. Nothing is saved.
export default function Try() {
  const [form, setForm] = useState({ requestText: "", orgName: "", city: "", donorName: "" });
  const [shot, setShot] = useState<Shot | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const { steps, result, error, busy, run } = useVerify();
  const onShot = useCallback((s: Shot | null) => setShot(s), []);

  return (
    <main>
      <header>
        <a className="back" href="/">← Home</a>
        <h1>Try any photo</h1>
        <p>Check a delivery photo against any request. Nothing is saved.</p>
      </header>

      <div className="grid">
        <section className="card">
          <h2>1 · The request and the proof</h2>
          <div className="samples">
            {SAMPLES.map(({ label, ...s }) => (
              <button key={label} type="button" onClick={() => setForm(s)}>{label}</button>
            ))}
          </div>
          <label htmlFor="req">What the nonprofit asked for</label>
          <textarea id="req" value={form.requestText} onChange={(e) => setForm({ ...form, requestText: e.target.value })} placeholder="We need 40 new winter coats, adult M to XL, before Dec 15" />
          <div className="row">
            <div>
              <label htmlFor="org">Nonprofit</label>
              <input id="org" type="text" value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
            </div>
            <div>
              <label htmlFor="city">City</label>
              <input id="city" type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <label htmlFor="donor">Donor</label>
          <input id="donor" type="text" value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })} />
          <Camera onShot={onShot} disabled={busy} />
          <button className="btn primary block" disabled={busy} onClick={() => (shot ? (setLocalError(null), run(shot, form)) : setLocalError("Add a delivery photo first."))}>
            {busy ? "Verifying…" : "Verify delivery"}
          </button>
          {(localError || error) && <p className="err">{localError || error}</p>}
        </section>

        <section className="card">
          <h2>2 · What the agent did</h2>
          <StepList steps={steps} />
          {result && <Verdict result={result} />}
          {result?.impact.donorMessage && <div className="note"><strong>Draft thank-you note:</strong> {result.impact.donorMessage}</div>}
        </section>
      </div>
    </main>
  );
}
