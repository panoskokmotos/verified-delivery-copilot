import Link from "next/link";
import { listDeliveries } from "../../lib/store";
import { DONOR_STATUS, itemsLine } from "../labels";

export const dynamic = "force-dynamic";

export default async function DonorHome() {
  const deliveries = await listDeliveries();
  return (
    <main>
      <header>
        <Link className="back" href="/">← Home</Link>
        <h1>Your gifts</h1>
        <p>Every gift shows where it is. The photo and thank-you appear once the delivery is proven.</p>
      </header>
      <ul className="list">
        {deliveries.map((d) => {
          const done = d.status === "approve" && d.result;
          return (
            <li key={d.id} className="card gift-card">
              <div className="gift-head">
                <div>
                  <div className="title">{itemsLine(d)}</div>
                  <div className="sub">To {d.orgName}, {d.city} · from {d.donorName}</div>
                </div>
                <span className={`pill ${done ? "approve" : "pending"}`}>{DONOR_STATUS[d.status]}</span>
              </div>
              {done && d.result && (
                <div className="gift-proof">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photo/${d.id}`} alt={`Delivery photo at ${d.orgName}`} />
                  <p>{d.result.impact.donorMessage}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
