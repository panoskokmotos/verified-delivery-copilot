"use client";

import { useState } from "react";
import type { IntegrityCheck, ItemCheck, Need, OrgCheck, StepEvent, StepName, VerificationResult, VisionCheck } from "../lib/types";

export const STEPS: { key: StepName; title: string; what: string }[] = [
  { key: "intake", title: "Read the gift", what: "Nemotron turns the request and the donor's items into a checklist" },
  { key: "vision", title: "Look at the photo", what: "Vision model checks each item, its count and condition" },
  { key: "integrity", title: "Check the photo is genuine", what: "AI content label, reused-photo fingerprint, timestamp" },
  { key: "org", title: "Confirm the nonprofit", what: "Tavily web search for the organization" },
  { key: "decision", title: "Decide", what: "Rule score plus Nemotron review, can only get stricter" },
  { key: "impact", title: "Close the loop", what: "Donor thank-you, only after approval" },
];

type StepState = { status: "idle" | "running" | "done" | "error" | "skipped"; ms?: number; model?: string; data?: unknown; error?: string };

function summary(key: StepName, data: unknown): string {
  if (!data) return "";
  switch (key) {
    case "intake": {
      const n = data as Need;
      return n.items.map((i) => `${i.quantity} ${i.unit}`).join(" · ") + (n.mustHave?.length ? ` · must show: ${n.mustHave.join(", ")}` : "");
    }
    case "vision": {
      const v = data as VisionCheck;
      const ok = v.itemChecks.filter((c) => c.status === "seen").length;
      return `${ok} of ${v.itemChecks.length} items shown · ${Math.round(v.confidence * 100)}% sure${v.aiSuspicion !== "none" ? ` · ${v.aiSuspicion} signs of AI` : ""}`;
    }
    case "integrity": {
      const i = data as IntegrityCheck;
      return i.flags.length ? `${i.flags.length} flag(s)` : `Clean · ${i.photoTakenAt ? "taken " + new Date(i.photoTakenAt).toLocaleDateString() : "no camera timestamp"}`;
    }
    case "org": {
      const o = data as OrgCheck;
      return o.ran ? (o.found ? "Found on the web" : "Not found") : o.summary;
    }
    default:
      return "";
  }
}

/**
 * Vercel caps a request at 4.5 MB. Large photos are shrunk in the browser, and the first 512 KB
 * of the original goes along with them: that header holds the camera data and any AI content label.
 */
async function prepare(file: File): Promise<{ photo: Blob; meta?: Blob }> {
  if (file.size <= 4_000_000) return { photo: file };
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const photo = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Could not read the photo"))), "image/jpeg", 0.85));
  return { photo, meta: file.slice(0, 512 * 1024) };
}

export function useVerify() {
  const [steps, setSteps] = useState<Record<string, StepState>>({});
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The exact bytes sent for the check. Confirming sends them again, since the signature covers them.
  const [sent, setSent] = useState<{ photo: Blob; name: string; token?: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function run(file: File, fields: Record<string, string>) {
    setBusy(true);
    setError(null);
    setResult(null);
    setSteps({});
    setSent(null);
    try {
      const { photo, meta } = await prepare(file);
      setSent({ photo, name: file.name });
      const body = new FormData();
      Object.entries(fields).forEach(([k, v]) => body.append(k, v));
      body.append("photo", photo, file.name);
      if (meta) body.append("meta", meta, "meta.bin");
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
          if (e.type === "final") {
            setResult(e.result);
            setSent((s) => (s ? { ...s, token: e.confirmToken } : s));
          }
          if (e.type === "error") setError(e.error);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  /** Saves an approved check so the donor sees it. Only possible when the check returned a token. */
  async function confirm(deliveryId: string, note = "") {
    if (!result || !sent?.token) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("deliveryId", deliveryId);
      body.append("result", JSON.stringify(result));
      body.append("confirmToken", sent.token);
      body.append("note", note);
      body.append("photo", sent.photo, sent.name);
      const res = await fetch("/api/confirm", { method: "POST", body });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Confirm failed (${res.status})`);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return { steps, result, error, busy, run, confirm, canConfirm: Boolean(sent?.token) && !confirmed, confirmed };
}

export function StepList({ steps }: { steps: Record<string, StepState> }) {
  return (
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
  );
}

const MARK: Record<ItemCheck["status"], string> = { seen: "✓", partial: "!", missing: "✕", unclear: "?" };

/** Each donated item against what the photo shows: green tick, amber partial, red missing. */
export function ItemChecks({ checks }: { checks: ItemCheck[] }) {
  return (
    <ul className="items">
      {checks.map((c, i) => (
        <li key={i} className={c.status}>
          <span className="mark">{MARK[c.status]}</span>
          <div>
            <div className="title">{c.name}</div>
            <div className="sub">{c.note}</div>
            {c.where && <div className="where">📍 {c.where}</div>}
          </div>
          <span className="count">{c.seen ?? "?"}/{c.expected}</span>
        </li>
      ))}
    </ul>
  );
}

const HEADLINE = { approve: "Every item checks out", review: "Genuine photo, some items not fully visible", reject: "This photo can't be accepted" };

export function Verdict({ result }: { result: VerificationResult }) {
  const flags = result.integrity.flags.filter((f) => !result.decision.reasons.includes(f));
  const approved = result.decision.verdict === "approve";
  return (
    <>
      <ItemChecks checks={result.vision.itemChecks} />
      <div className={`verdict ${result.decision.verdict}`}>
        <div className="big">
          {HEADLINE[result.decision.verdict]} · {result.decision.score}/100
        </div>
        <ul>{result.decision.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        {result.decision.verdict === "reject" && <div className="next">Next: {result.decision.nextAction}</div>}
      </div>
      {result.decision.verdict === "review" && (
        <div className="notice">
          <div className="title">Heads up: not everything shows in this photo</div>
          <ul>
            {result.vision.itemChecks.filter((c) => c.status !== "seen").map((c, i) => (
              <li key={i}>{c.name}: {c.seen ?? "?"} of {c.expected} visible. {c.note}</li>
            ))}
          </ul>
          <div style={{ marginTop: 6 }}>{result.decision.nextAction} Or send it as is: donors will see exactly which items the photo shows.</div>
        </div>
      )}
      {flags.length > 0 && <ul className="flags">{flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
    </>
  );
}
