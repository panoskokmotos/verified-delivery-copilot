"use client";

import { useEffect, useRef, useState } from "react";
import type { StepEvent, StepName, VerificationResult, VisionCheck, IntegrityCheck, OrgCheck, Need } from "../lib/types";

const STEPS: { key: StepName; title: string; what: string }[] = [
  { key: "intake", title: "Read the request", what: "Nemotron turns the nonprofit's ask into a checklist" },
  { key: "vision", title: "Look at the photo", what: "Nemotron vision checks item, count, condition, setting" },
  { key: "integrity", title: "Check the photo is genuine", what: "AI content label, reused-photo fingerprint, timestamp" },
  { key: "org", title: "Confirm the nonprofit", what: "Tavily web search for the organization" },
  { key: "decision", title: "Decide", what: "Rule score plus Nemotron review, can only get stricter" },
  { key: "impact", title: "Close the loop", what: "Donor thank-you, only after approval" },
];

const SAMPLES = [
  {
    label: "Shelter: winter coats",
    requestText: "We need 40 new winter coats, adult sizes M to XL, for our overnight shelter before Dec 15.",
    orgName: "Harbor House Shelter",
    city: "Oakland, CA",
    donorName: "Maria",
  },
  {
    label: "Pantry: diapers",
    requestText: "Food pantry needs 12 packs of size 4 diapers, sealed, any brand.",
    orgName: "Eastside Family Pantry",
    city: "Austin, TX",
    donorName: "Acme Corp CSR team",
  },
  {
    label: "Animal rescue: dog food",
    requestText: "Please send 10 bags of dry dog food, 30 lb bags, unopened.",
    orgName: "Second Chance Animal Rescue",
    city: "Los Angeles, CA",
    donorName: "Daniel",
  },
];

type StepState = { status: "idle" | "running" | "done" | "error" | "skipped"; ms?: number; model?: string; data?: unknown; error?: string };

function summary(key: StepName, data: unknown): string {
  if (!data) return "";
  switch (key) {
    case "intake": {
      const n = data as Need;
      return `${n.quantity} ${n.unit} · ${n.item} · ${n.condition.replace("_", " ")}${n.mustHave?.length ? " · must show: " + n.mustHave.join(", ") : ""}`;
    }
    case "vision": {
      const v = data as VisionCheck;
      return `${v.matchesNeed ? "Match" : "No match"} · sees ${v.itemsSeen.join(", ")} · count ${v.estimatedCount ?? "?"} (${v.countConfidence}) · ${Math.round(v.confidence * 100)}% sure`;
    }
    case "integrity": {
      const i = data as IntegrityCheck;
      return i.flags.length ? `${i.flags.length} flag(s)` : `Clean · ${i.photoTakenAt ? "taken " + new Date(i.photoTakenAt).toLocaleDateString() : "no timestamp"}`;
    }
    case "org": {
      const o = data as OrgCheck;
      return o.ran ? (o.found ? "Found on the web" : "Not found") : o.summary;
    }
    default:
      return "";
  }
}

export default function Home() {
  const [form, setForm] = useState({ requestText: "", orgName: "", city: "", donorName: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, StepState>>({});
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((j) => setMode(j.mode)).catch(() => {});
  }, []);

  function pick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function run() {
    if (!file) return setError("Add a delivery photo first.");
    setBusy(true);
    setError(null);
    setResult(null);
    setSteps({});
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    body.append("photo", file);
    try {
      const res = await fetch("/api/verify", { method: "POST", body });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as StepEvent;
          if (e.type === "step") setSteps((s) => ({ ...s, [e.step]: { status: e.status, ms: e.ms, model: e.model, data: e.data, error: e.error } }));
          if (e.type === "final") setResult(e.result);
          if (e.type === "error") setError(e.error);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const flags = (result?.integrity.flags ?? []).filter((f) => !result?.decision.reasons.includes(f));
  const approved = result?.decision.verdict === "approve";

  return (
    <main>
      <header>
        <h1>
          Verified Delivery Copilot
          {mode && <span className={`badge ${mode === "live" ? "live" : ""}`}>{mode === "live" ? "Live · Nemotron on Nebius" : "Demo mode"}</span>}
        </h1>
        <p>Did the donation actually arrive? Upload the nonprofit's delivery photo. An agent checks it against what was asked for and only then thanks the donor.</p>
      </header>

      <div className="grid">
        <section className="card">
          <h2>1 · The request and the proof</h2>
          <div className="samples">
            {SAMPLES.map((s) => (
              <button key={s.label} type="button" onClick={() => setForm({ requestText: s.requestText, orgName: s.orgName, city: s.city, donorName: s.donorName })}>
                {s.label}
              </button>
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
          <div className="drop" onClick={() => inputRef.current?.click()}>
            {preview ? <img src={preview} alt="Delivery photo" /> : "Tap to add the delivery photo (JPG, PNG, WEBP)"}
          </div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <button className="go" disabled={busy} onClick={run}>{busy ? "Verifying…" : "Verify delivery"}</button>
          {error && <p className="err">{error}</p>}
        </section>

        <section className="card">
          <h2>2 · What the agent did</h2>
          <ul className="steps">
            {STEPS.map((s) => {
              const st = steps[s.key] ?? { status: "idle" };
              return (
                <li key={s.key}>
                  <span className={`dot ${st.status}`} />
                  <div>
                    <div className="title">{s.title}</div>
                    <div className="sub">{st.status === "error" ? st.error : summary(s.key, st.data) || s.what}</div>
                    {st.model && <div className="sub">model: {st.model}</div>}
                  </div>
                  <span className="ms">{st.ms !== undefined ? `${(st.ms / 1000).toFixed(1)}s` : ""}</span>
                </li>
              );
            })}
          </ul>

          {result && (
            <>
              <div className={`verdict ${result.decision.verdict}`}>
                <div className="big">{result.decision.verdict} · {result.decision.score}/100</div>
                <ul>{result.decision.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                <div className="next">Next: {result.decision.nextAction}</div>
              </div>
              {flags.length > 0 && <ul className="flags">{flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
              {result.impact.donorMessage && (
                <div className="note">
                  <strong>{approved ? `To ${form.donorName || "the donor"}:` : "Donor message:"}</strong> {result.impact.donorMessage}
                  {result.impact.publicCaption && <div className="sub" style={{ marginTop: 6 }}>Feed: {result.impact.publicCaption}</div>}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <footer>
        Built for the Nebius x NVIDIA Global AI Hackathon. Runs NVIDIA Nemotron models on Nebius Token Factory. Case ID {result?.id ?? "n/a"}.
      </footer>
    </main>
  );
}
