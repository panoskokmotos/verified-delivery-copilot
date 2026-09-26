import Link from "next/link";
import { listDeliveries } from "../../lib/store";
import { DeliveryCard } from "../delivery-card";

export const dynamic = "force-dynamic";

export default async function NonprofitHome() {
  const deliveries = await listDeliveries();
  const needProof = deliveries.filter((d) => d.status !== "approve" && d.status !== "shipping").length;
  return (
    <main>
      <header>
        <Link className="back" href="/">← Home</Link>
        <h1>Deliveries</h1>
        <p>{needProof} deliveries have arrived and need proof. One photo per delivery, showing every item from every donor.</p>
      </header>
      <ul className="list">
        {deliveries.map((d) => (
          <li key={d.id}><DeliveryCard d={d} /></li>
        ))}
      </ul>
    </main>
  );
}
