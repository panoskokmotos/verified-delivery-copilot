import Link from "next/link";
import { DONORS } from "../../lib/demo";
import { listDeliveries } from "../../lib/store";

export const dynamic = "force-dynamic";

// Demo sign-in: pick a donor.
export default async function DonorPicker() {
  const deliveries = await listDeliveries();
  return (
    <main>
      <header>
        <Link className="back" href="/">← Home</Link>
        <h1>Who's giving?</h1>
        <p>Demo donors. Each one gave to one or more batched deliveries.</p>
      </header>
      <ul className="list">
        {Object.entries(DONORS).map(([id, name]) => {
          const gifts = deliveries.filter((d) => d.donations.some((x) => x.donorId === id));
          const proven = gifts.filter((d) => d.status === "approve").length;
          return (
            <li key={id}>
              <Link className="card row-link" href={`/donor/${id}`} style={{ display: "flex", justifyContent: "space-between", textDecoration: "none" }}>
                <span><span className="avatar">{name[0]}</span><strong>{name}</strong></span>
                <span className="sub">{gifts.length} gifts · {proven} with checked proof</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
