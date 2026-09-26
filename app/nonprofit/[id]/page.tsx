import Link from "next/link";
import { notFound } from "next/navigation";
import { getDelivery } from "../../../lib/store";
import { DeliveryBar } from "../../delivery-card";
import { Upload } from "./upload";

export const dynamic = "force-dynamic";

export default async function NonprofitDelivery({ params }: { params: Promise<{ id: string }> }) {
  const delivery = await getDelivery((await params).id);
  if (!delivery) notFound();
  return (
    <main>
      <Link className="back" href="/nonprofit">← Deliveries</Link>
      <div className="delivery" style={{ marginTop: 4 }}>
        <DeliveryBar d={delivery} />
        <div className="body">
          <h1 style={{ fontSize: 24, margin: 0 }}>{delivery.orgName}</h1>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            {delivery.city} · order {delivery.orderCode} from {delivery.supplier} · {delivery.donations.length} donors
          </p>
        </div>
      </div>
      <Upload delivery={delivery} />
    </main>
  );
}
