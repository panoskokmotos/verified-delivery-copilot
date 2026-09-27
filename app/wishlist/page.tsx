import Link from "next/link";
import { DONORS, ORGS } from "../../lib/demo";
import { listWishlists } from "../../lib/store";
import { money, productIcon } from "../labels";
import { RecallBadge } from "../recall-badge";
import { Give } from "./give";

export const dynamic = "force-dynamic";

// What nonprofits need, as on Givelink: donors buy a specific product and it ships to the nonprofit.
export default async function Wishlists({ searchParams }: { searchParams: Promise<{ donor?: string }> }) {
  const lists = await listWishlists();
  const { donor } = await searchParams;
  const donors = Object.entries(DONORS);
  return (
    <main>
      <header>
        <Link className="back" href="/">← Home</Link>
        <h1>Wishlists</h1>
        <p>
          What each nonprofit needs right now. Every product was checked against public recall databases when it was added. Give one, and
          it ships to the nonprofit, who sends you a checked photo when it arrives.
        </p>
      </header>
      {ORGS.map((org) => {
        const items = lists[org.id] ?? [];
        return (
          <section key={org.id} className="card" style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 2 }}>{org.name}</h2>
            <p className="sub" style={{ margin: 0 }}>{org.city} · {org.cause}</p>
            <ul className="wishes">
              {items.map((i) => {
                const left = Math.max(0, i.quantity - i.given);
                return (
                  <li key={i.id} className="wish">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <div className="thumb">{i.image ? <img src={i.image} alt={i.name} /> : productIcon(i.name)}</div>
                    <div>
                      <div className="title">{i.name}</div>
                      <div className="sub">
                        {i.given} of {i.quantity} given{i.price ? ` · ${money(i.price)} each` : ""}
                        {i.url && <> · <a href={i.url} target="_blank" rel="noreferrer">product page</a></>}
                      </div>
                      <div className="bar-need"><span style={{ width: `${Math.min(100, (i.given / i.quantity) * 100)}%` }} /></div>
                      <RecallBadge recall={i.recall} />
                      {i.recall?.status === "found" ? (
                        <p className="sub">Can&apos;t be given while a recall notice applies.</p>
                      ) : left > 0 ? (
                        <Give orgId={org.id} itemId={i.id} left={left} donors={donors} donor={donor} />
                      ) : (
                        <p className="ok">Fully given. Thank you.</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
