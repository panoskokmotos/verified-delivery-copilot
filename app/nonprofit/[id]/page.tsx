import Link from "next/link";
import { notFound } from "next/navigation";
import { getDelivery } from "../../../lib/store";
import { Upload } from "./upload";

export const dynamic = "force-dynamic";

export default async function NonprofitDelivery({ params }: { params: Promise<{ id: string }> }) {
  const delivery = await getDelivery((await params).id);
  if (!delivery) notFound();
  return (
    <main>
      <header>
        <Link className="back" href="/nonprofit">← All deliveries</Link>
        <h1>{delivery.orgName}</h1>
        <p>{delivery.city} · gift from {delivery.donorName}</p>
      </header>
      <Upload delivery={delivery} />
    </main>
  );
}
