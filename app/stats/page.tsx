import Link from "next/link";
import { computeStats } from "../../lib/stats";
import { listDeliveries } from "../../lib/store";
import { money } from "../labels";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const s = computeStats(await listDeliveries());
  const tiles: [string, string][] = [
    ["Proofs shared", `${s.proofsShared} of ${s.deliveries}`],
    ["Items proven in photos", String(s.itemsProven)],
    ["Value proven", money(s.valueProven)],
    ["Fakes stopped", String(s.fakesStopped)],
    ["Complete / partial", `${s.complete} / ${s.partial}`],
    ["Median days, arrival to proof", s.medianDaysToProof === null ? "n/a" : String(s.medianDaysToProof)],
  ];
  return (
    <main>
      <header>
        <Link className="back" href="/">← Home</Link>
        <h1>Open delivery data</h1>
        <p>
          In-kind giving rarely publishes whether goods arrived. These numbers come straight from checked delivery photos. Anyone can use
          them. Demo data for now.
        </p>
      </header>
      <div className="tiles">
        {tiles.map(([k, v]) => (
          <div className="card tile" key={k}>
            <div className="big-num">{v}</div>
            <div className="sub">{k}</div>
          </div>
        ))}
      </div>
      <section className="card" style={{ marginTop: 20 }}>
        <h2>By cause</h2>
        <table className="table">
          <thead><tr><th>Cause</th><th>Deliveries</th><th>Items proven</th><th>Value proven</th></tr></thead>
          <tbody>
            {s.byCause.map((c) => (
              <tr key={c.cause}><td>{c.cause}</td><td>{c.deliveries}</td><td>{c.itemsProven}</td><td>{money(c.valueProven)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card" style={{ marginTop: 20 }}>
        <h2>Use the data</h2>
        <p className="sub" style={{ marginTop: 0 }}>No donor names in any export. Receipts follow an open format any platform can issue.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn primary sm" href="/api/stats?format=csv">Download CSV</a>
          <a className="btn subtle sm" href="/api/stats">JSON</a>
          <a className="btn subtle sm" href="https://github.com/panoskokmotos/verified-delivery-copilot/blob/main/docs/receipt.schema.json">Receipt format</a>
        </div>
      </section>
    </main>
  );
}
