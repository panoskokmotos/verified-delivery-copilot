import Link from "next/link";
import { notFound } from "next/navigation";
import { DONORS } from "../../../lib/demo";
import { listDeliveries } from "../../../lib/store";
import type { Delivery } from "../../../lib/types";
import { DonorItems } from "../../donor-items";
import { DONOR_STATUS, fmtDate } from "../../labels";
import { Questions } from "../../questions";
import { verified } from "../../../lib/verified";
import { ShareButton } from "../../share-button";

export const dynamic = "force-dynamic";

function Timeline({ d }: { d: Delivery }) {
  const arrived = d.status !== "shipping";
  const proven = d.status === "approve";
  const steps: { label: string; state: "done" | "now" | ""; tag?: string }[] = [
    { label: "Items purchased", state: "done" },
    { label: "Shipment scheduled", state: "done" },
    { label: `Items being delivered by ${d.supplier}`, state: arrived ? "done" : "now", tag: "Usually a few days" },
    { label: arrived ? `Items delivered ${fmtDate(d.arrivesAt)}` : "Items delivered", state: arrived ? "done" : "" },
    { label: `${d.orgName} sends you a photo`, state: proven ? "done" : arrived ? "now" : "", tag: "Straight from the nonprofit" },
    { label: "Every item checked against the photo", state: proven ? "done" : "" },
  ];
  return (
    <ol className="timeline">
      {steps.map((s, i) => (
        <li key={i} className={s.state}>
          <span className="tick">{s.state === "done" ? "✓" : i + 1}</span>
          <div className={s.state ? "" : "sub"}>
            {s.label}
            {s.tag && s.state === "now" && <span className="tag">{s.tag}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function DonorGifts({ params }: { params: Promise<{ donorId: string }> }) {
  const { donorId } = await params;
  const name = DONORS[donorId];
  if (!name) notFound();
  const gifts = (await listDeliveries()).filter((d) => d.donations.some((x) => x.donorId === donorId));
  return (
    <main>
      <header>
        <Link className="back" href="/donor">← Donors</Link>
        <h1>{name}'s gifts</h1>
        <p>Follow each gift to the door. When it lands, the nonprofit sends a photo and every item you gave is checked against it.</p>
      </header>
      <ul className="list">
        {gifts.map((d) => {
          const mine = d.donations.find((x) => x.donorId === donorId)!;
          const proven = d.status === "approve" && d.result;
          return (
            <li key={d.id} className="card">
              <div className="receipt-head">
                <div>
                  <div className="title">{mine.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</div>
                  <div className="sub">To {d.orgName}, {d.city} · part of a delivery from {d.donations.length} donors</div>
                </div>
                <span className={`pill ${proven ? (d.result!.vision.itemChecks.every((c) => c.status === "seen") ? "success" : "warning") : "pending"}`}>
                  {proven && !verified(d.result!)
                    ? "Delivered · photo not verified"
                    : proven && !d.result!.vision.itemChecks.every((c) => c.status === "seen")
                      ? "Delivered · partly shown in photo"
                      : DONOR_STATUS[d.status]}
                </span>
              </div>
              <Timeline d={d} />
              {proven && (
                <>
                  <div className="photo-pair">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photo/${d.id}`} alt={`Delivery photo at ${d.orgName}`} />
                    <div>
                      <div className="title" style={{ marginBottom: 8 }}>Your items in this photo</div>
                      <DonorItems d={d} donorId={donorId} />
                    </div>
                  </div>
                  {d.thankYouNote && (
                    <div className="quote">
                      <div className="from">From {d.orgName}</div>
                      {d.thankYouNote}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    <Link className="btn primary sm" href={`/proof/${d.id}?donor=${donorId}`}>View receipt</Link>
                    <ShareButton path={`/proof/${d.id}?donor=${donorId}`} label="Share this story" />
                    <a className="btn subtle sm" href={`/api/photo/${d.id}?download=1`}>Download photo</a>
                  </div>
                  <div className="title" style={{ marginTop: 18 }}>Questions for {d.orgName}</div>
                  <Questions delivery={d} as={{ donorId }} />
                </>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
