"use client";

import { useCallback, useState } from "react";
import { Camera, type Shot } from "../camera";
import { StepList, Verdict, useVerify } from "../verify-ui";

const SAMPLES = [
  { label: "Winter coats", requestText: "10 adult winter coats, sizes M to XL" },
  { label: "Diapers", requestText: "12 packs of size 4 diapers, sealed" },
  { label: "Dog food", requestText: "4 bags of dry dog food, 30 lb" },
  { label: "School supplies", requestText: "30 spiral notebooks, 10 packs of pencils, 5 kids backpacks" },
];

// Open tool: check any photo against any request. Nothing is saved.
export default function Try() {
  const [form, setForm] = useState({ requestText: "" });
  const [shot, setShot] = useState<Shot | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const { steps, result, error, busy, run } = useVerify();
  const onShot = useCallback((s: Shot | null) => setShot(s), []);

  return (
    <main>
      <header>
        <a className="back" href="/">← Home</a>
        <h1>Try any photo</h1>
        <p>Type what was donated, or pick an example, then add a photo. The agent checks whether the photo shows it. Nothing is saved.</p>
      </header>

      <div className="grid">
        <section className="card">
          <h2>1 · What was donated, and the photo</h2>
          <div className="samples">
            {SAMPLES.map(({ label, ...s }) => (
              <button key={label} type="button" onClick={() => setForm(s)}>{label}</button>
            ))}
          </div>
          <label htmlFor="req">What was donated</label>
          <textarea id="req" value={form.requestText} onChange={(e) => setForm({ requestText: e.target.value })} placeholder="e.g. 10 adult winter coats, sizes M to XL" />
          <Camera onShot={onShot} disabled={busy} />
          <button className="btn primary block" disabled={busy} onClick={() => (shot ? (setLocalError(null), run(shot, { ...form, orgName: "the nonprofit" })) : setLocalError(form.requestText ? "Add a photo first." : "Say what was donated first, or pick an example."))}>
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
