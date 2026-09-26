"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Delivery } from "../lib/types";

/**
 * Donors ask the nonprofit about a delivery, the nonprofit answers. Donors see their own questions and
 * every answered one; the public receipt shows answered ones without names.
 */
export function Questions({ delivery, as }: { delivery: Delivery; as: "nonprofit" | { donorId: string } | "public" }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const all = delivery.questions ?? [];
  const shown = as === "public" ? all.filter((q) => q.answer) : as === "nonprofit" ? all : all.filter((q) => q.answer || q.donorId === as.donorId);

  async function post(body: object) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliveryId: delivery.id, ...body }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error || "Could not send");
    setText("");
    router.refresh();
  }

  return (
    <div>
      {shown.length === 0 && <p className="sub">{as === "nonprofit" ? "No questions yet." : "No questions yet. Ask the nonprofit anything about this delivery."}</p>}
      <ul className="qa">
        {shown.map((q) => (
          <li key={q.id}>
            <div className="q">{as === "public" ? "A donor asked" : q.donorName}: {q.text}</div>
            {q.answer ? (
              <div className="a"><strong>{delivery.orgName}:</strong> {q.answer}</div>
            ) : as === "nonprofit" ? (
              <div className="ask">
                <input type="text" placeholder="Your answer" value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                <button className="btn primary sm" disabled={busy || !answers[q.id]?.trim()} onClick={() => post({ questionId: q.id, answer: answers[q.id] })}>Answer</button>
              </div>
            ) : (
              <div className="sub">Waiting for an answer</div>
            )}
          </li>
        ))}
      </ul>
      {typeof as === "object" && (
        <div className="ask">
          <input type="text" placeholder={`Ask ${delivery.orgName} a question`} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
          <button className="btn subtle sm" disabled={busy || !text.trim()} onClick={() => post({ donorId: as.donorId, text })}>Ask</button>
        </div>
      )}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
