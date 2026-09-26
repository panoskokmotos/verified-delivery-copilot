import Link from "next/link";
import { listDeliveries } from "../../lib/store";
import { BAR, ago, itemCount } from "../labels";
import { Products } from "../products";

export const dynamic = "force-dynamic";

export default async function NonprofitHome() {
  const deliveries = await listDeliveries();
  const waiting = deliveries.filter((d) => d.status !== "approve").length;
  return (
    <main>
      <header>
        <Link className="back" href="/">← Home</Link>
        <h1>Your deliveries</h1>
        <p>{waiting} deliveries have arrived and need proof. One photo per delivery, showing every item.</p>
      </header>
      <ul className="list">
        {deliveries.map((d) => (
          <li key={d.id}>
            <Link className="delivery" href={`/nonprofit/${d.id}`}>
              <div className={`bar ${d.status}`}>
                <span>{BAR[d.status]}</span>
                <span className="when">{d.status === "approve" ? `Confirmed ${ago(d.updatedAt)}` : `Pledged ${ago(d.pledgedAt)}`}</span>
              </div>
              <div className="body">
                <div className="title" style={{ marginBottom: 10 }}>{d.orgName}</div>
                <Products items={d.items} />
              </div>
              <div className="foot">
                <span><span className="avatar">{d.donorName[0]}</span>From {d.donorName} · {itemCount(d.items)} items</span>
                <span>{d.status === "approve" ? "Proof shared" : "Upload delivery proof →"}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
