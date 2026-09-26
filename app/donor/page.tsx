import Link from "next/link";
import { listDeliveries } from "../../lib/store";
import type { Delivery } from "../../lib/types";
import { DONOR_STATUS, itemsLine } from "../labels";
import { ItemChecks } from "../verify-ui";

export const dynamic = "force-dynamic";

function Timeline({ d }: { d: Delivery }) {
  const confirmed = d.status === "approve";
  const steps = [
    { label: "Items purchased", state: "done" },
    { label: "Items delivered", state: d.status === "awaiting_photo" ? "now" : "done", tag: d.status === "awaiting_photo" ? "Usually a few days" : undefined },
    { label: `${d.orgName} sends you a photo`, state: confirmed ? "done" : d.status === "awaiting_photo" ? "" : "now", tag: "Straight from the nonprofit" },
    { label: "Every item checked against the photo", state: confirmed ? "done" : "" },
  ];
  return (
    <ol className="timeline">
      {steps.map((s, i) => (
        <li key={i} className={s.state}>
          <span className="tick">{s.state === "done" ? "✓" : i + 1}</span>
          <div className={s.state ? "" : "sub"}>
            {s.label}
            {s.tag && s.state !== "done" && <span className="tag">{s.tag}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function DonorHome() {
  const deliveries = await listDeliveries();
  return (
    <main>
      <header>
        <Link className="back" href="/">← Home</Link>
        <h1>Your gifts</h1>
        <p>Follow every gift to the door. When it lands, the nonprofit sends a photo, and every item you gave is checked against it.</p>
      </header>
      <ul className="list">
        {deliveries.map((d) => (
          <li key={d.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
              <div>
                <div className="title">{itemsLine(d)}</div>
                <div className="sub">To {d.orgName}, {d.city} · from {d.donorName}</div>
              </div>
              <span className={`pill ${d.status === "approve" ? "success" : "pending"}`}>{DONOR_STATUS[d.status]}</span>
            </div>
            <Timeline d={d} />
            {d.status === "approve" && d.result && (
              <div className="proof">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/photo/${d.id}`} alt={`Delivery photo at ${d.orgName}`} />
                <div>
                  <p style={{ marginTop: 0 }}>{d.result.impact.donorMessage}</p>
                  <ItemChecks checks={d.result.vision.itemChecks} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
