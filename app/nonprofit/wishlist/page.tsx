import Link from "next/link";
import { ORGS } from "../../../lib/demo";
import { listWishlists } from "../../../lib/store";
import { productIcon } from "../../labels";
import { RecallBadge } from "../../recall-badge";
import { AddProduct } from "./add-product";

export const dynamic = "force-dynamic";

// The nonprofit's wishlist: add the products you need; each is checked for recalls before donors see it.
export default async function NonprofitWishlist({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: orgParam } = await searchParams;
  const org = ORGS.find((o) => o.id === orgParam) ?? ORGS[0];
  const items = (await listWishlists())[org.id] ?? [];
  return (
    <main>
      <header>
        <Link className="back" href="/nonprofit">← Deliveries</Link>
        <h1>Your wishlist</h1>
        <p>Add what you need. Before donors see a product, we read its page for the official photo and search public recall databases for it.</p>
      </header>
      <div className="samples" style={{ marginTop: 14 }}>
        {ORGS.map((o) => (
          <Link key={o.id} href={`/nonprofit/wishlist?org=${o.id}`} className={`pill ${o.id === org.id ? "success" : ""}`}>{o.name}</Link>
        ))}
      </div>
      <div className="grid">
        <section className="card">
          <h2>Add a product</h2>
          <AddProduct orgId={org.id} />
        </section>
        <section className="card">
          <h2>{org.name}</h2>
          <ul className="wishes">
            {items.map((i) => (
              <li key={i.id} className="wish">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="thumb">{i.image ? <img src={i.image} alt={i.name} /> : productIcon(i.name)}</div>
                <div>
                  <div className="title">{i.name}</div>
                  <div className="sub">{i.given} of {i.quantity} given</div>
                  <RecallBadge recall={i.recall} />
                  {i.recall?.status === "found" && <p className="sub">{i.recall.summary}</p>}
                  {!i.recall && <p className="sub">Added before recall checks.</p>}
                </div>
              </li>
            ))}
          </ul>
          <p className="sub" style={{ marginTop: 12 }}><Link href="/wishlist">See it as a donor →</Link></p>
        </section>
      </div>
    </main>
  );
}
