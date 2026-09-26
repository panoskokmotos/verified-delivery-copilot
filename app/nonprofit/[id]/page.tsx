import Link from "next/link";
import { notFound } from "next/navigation";
import { getDelivery } from "../../../lib/store";
import { BAR, ago } from "../../labels";
import { Upload } from "./upload";

export const dynamic = "force-dynamic";

export default async function NonprofitDelivery({ params }: { params: Promise<{ id: string }> }) {
  const delivery = await getDelivery((await params).id);
  if (!delivery) notFound();
  return (
    <main>
      <Link className="back" href="/nonprofit">← All deliveries</Link>
      <div className="delivery" style={{ marginTop: 4 }}>
        <div className={`bar ${delivery.status}`}>
          <span>{BAR[delivery.status]}</span>
          <span className="when">Pledged {ago(delivery.pledgedAt)}</span>
        </div>
        <div className="body">
          <h1 style={{ fontSize: 24, margin: 0 }}>{delivery.orgName}</h1>
          <p className="sub" style={{ margin: "4px 0 0" }}>{delivery.city} · gift from {delivery.donorName} · your request: “{delivery.requestText}”</p>
        </div>
      </div>
      <Upload delivery={delivery} />
    </main>
  );
}
