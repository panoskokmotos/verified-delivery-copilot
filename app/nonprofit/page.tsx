import Link from "next/link";
import { listDeliveries } from "../../lib/store";
import { NONPROFIT_STATUS, itemsLine } from "../labels";

export const dynamic = "force-dynamic";

export default async function NonprofitHome() {
  const deliveries = await listDeliveries();
  return (
    <main>
      <header>
        <Link className="back" href="/">← Home</Link>
        <h1>Deliveries to confirm</h1>
        <p>Donors sent these items. Upload one photo per delivery showing everything that arrived.</p>
      </header>
      <ul className="list">
        {deliveries.map((d) => (
          <li key={d.id}>
            <Link className="card row-link" href={`/nonprofit/${d.id}`}>
              <div>
                <div className="title">{d.orgName}</div>
                <div className="sub">From {d.donorName} · {itemsLine(d)}</div>
              </div>
              <span className={`pill ${d.status}`}>{NONPROFIT_STATUS[d.status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
