import Link from "next/link";
import { allItems } from "../lib/items";
import type { Delivery } from "../lib/types";
import { BAR, ago, fmtDate } from "./labels";
import { Products } from "./products";
import { verified } from "../lib/verified";

/** The coloured status bar on top of a delivery. */
export function DeliveryBar({ d }: { d: Delivery }) {
  // Sent without passing the check: completed, but it must not look like a verified delivery.
  const unverified = d.status === "approve" && d.result && !verified(d.result);
  return (
    <div className={`bar ${unverified ? "unverified" : d.status}`}>
      <span>{unverified ? "Completed · not verified" : BAR[d.status]}</span>
      {d.status === "shipping" && <span className="when">Arrives: {fmtDate(d.arrivesAt)}</span>}
      {(d.status === "awaiting_photo" || d.status === "review" || d.status === "reject") && <span className="ago">{ago(d.arrivesAt)}</span>}
      {d.status === "approve" && <span className="when">Arrived: {fmtDate(d.arrivesAt)}</span>}
    </div>
  );
}

/** What the nonprofit should do next, one panel per state. */
function StatePanel({ d, linked }: { d: Delivery; linked: boolean }) {
  const n = d.donations.length;
  const cta = linked ? <span className="btn secondary sm">Upload delivery proof</span> : null;
  if (d.status === "shipping") {
    return (
      <div className="state shipping">
        <span className="icon">🚚</span>
        <div className="grow">
          <div className="title">Arrives {fmtDate(d.arrivesAt)}</div>
          <div className="sub">Shipped by {d.supplier}. Already arrived? {n} donors are waiting to see it land.</div>
        </div>
        {linked && <span className="btn primary sm">Upload delivery proof</span>}
      </div>
    );
  }
  if (d.status === "approve") {
    const ok = !d.result || verified(d.result);
    return (
      <div className={`state ${ok ? "approve" : "unverified"}`}>
        <span className="icon">{ok ? "✓" : "!"}</span>
        <div className="grow">
          <div className="title">Proof shared with {n} donors</div>
          <div className="sub">
            {d.result && !verified(d.result) ? "Sent without passing the check: donors see it marked Not verified." : "Every item was checked against your photo."}
          </div>
        </div>
      </div>
    );
  }
  if (d.status === "review" || d.status === "reject") {
    return (
      <div className={`state ${d.status}`}>
        <span className="icon">📷</span>
        <div className="grow">
          <div className="title">Retake needed</div>
          <div className="sub">{d.result?.decision.nextAction}</div>
        </div>
        {cta}
      </div>
    );
  }
  return (
    <div className="state awaiting_photo">
      <span className="icon">📷</span>
      <div className="grow">
        <div className="title">Items arrived. Share the proof</div>
        <div className="sub">One photo with every item lets all {n} donors see their gift land.</div>
      </div>
      {cta}
    </div>
  );
}

export function DeliveryCard({ d, linked = true }: { d: Delivery; linked?: boolean }) {
  const inner = (
    <>
      <DeliveryBar d={d} />
      <div className="body">
        <div className="title" style={{ marginBottom: 10 }}>{d.orgName}</div>
        <StatePanel d={d} linked={linked} />
        {d.status === "approve" ? (
          <div className="photo-pair">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photo/${d.id}`} alt={`Delivery proof at ${d.orgName}`} />
            <div><Products items={allItems(d)} /></div>
          </div>
        ) : (
          <Products items={allItems(d)} />
        )}
      </div>
      <div className="foot">
        <span>Supplier: <span className="avatar">{d.supplier[0]}</span>{d.supplier}</span>
        <span>{d.orderCode}</span>
      </div>
    </>
  );
  return linked ? <Link className="delivery" href={`/nonprofit/${d.id}`}>{inner}</Link> : <div className="delivery">{inner}</div>;
}
