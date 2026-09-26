import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allItems, itemCount } from "../../../lib/items";
import { receiptLimits } from "../../../lib/receipt";
import { getDelivery } from "../../../lib/store";
import type { Delivery } from "../../../lib/types";
import { DonorItems } from "../../donor-items";
import { fmtDate } from "../../labels";
import { ShareButton } from "../../share-button";
import { ItemChecks } from "../../verify-ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = await getDelivery((await params).id);
  return { title: d ? `Delivery receipt · ${d.orgName}` : "Delivery receipt" };
}

/** What passed, in plain words. */
function passed(d: Delivery): string[] {
  const r = d.result!;
  const seen = r.vision.itemChecks.filter((c) => c.status === "seen").length;
  const out = [`${seen} of ${r.vision.itemChecks.length} products fully visible and counted against what donors sent.`];
  if (!r.integrity.aiLabel) out.push("No AI-generated content label in the file.");
  if (!r.integrity.duplicateOf) out.push("The photo doesn't match any earlier delivery photo.");
  if (r.vision.aiSuspicion === "none") out.push("No visual signs of an AI-generated image.");
  const loc = r.integrity.location;
  if (loc?.photoKm !== null && loc?.photoKm !== undefined && loc.photoKm <= 25) out.push(`The photo's location data puts it ${loc.photoKm} km from the nonprofit's address.`);
  if (loc?.uploadKm !== null && loc?.uploadKm !== undefined && loc.uploadKm <= 25) out.push(`It was uploaded ${loc.uploadKm} km from the nonprofit's address.`);
  out.push("The nonprofit saw this check and confirmed it before donors were told.");
  return out;
}

export default async function Receipt({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ donor?: string }> }) {
  const d = await getDelivery((await params).id);
  if (!d) notFound();
  const donorId = (await searchParams).donor;
  const donor = donorId ? d.donations.find((x) => x.donorId === donorId) : undefined;
  const r = d.result;

  if (d.status !== "approve" || !r) {
    return (
      <main>
        <header>
          <h1>Not confirmed yet</h1>
          <p>This delivery to {d.orgName} has no checked proof yet. The receipt appears here once it does.</p>
        </header>
      </main>
    );
  }

  const path = `/proof/${d.id}${donor ? `?donor=${donor.donorId}` : ""}`;
  const seenCount = r.vision.itemChecks.filter((c) => c.status === "seen").length;
  const complete = seenCount === r.vision.itemChecks.length;
  return (
    <main>
      <div className="card">
        <div className="receipt-head">
          <div>
            {complete ? (
              <span className="pill success">✓ Delivery verified</span>
            ) : (
              <span className="pill warning">✓ Genuine photo · {seenCount} of {r.vision.itemChecks.length} products fully visible</span>
            )}
            <h1 style={{ fontSize: 26, margin: "10px 0 4px" }}>{d.orgName}</h1>
            <p className="sub" style={{ margin: 0 }}>
              {d.city} · {itemCount(allItems(d))} items from {d.donations.length} donors · arrived {fmtDate(d.arrivesAt)} · checked {d.updatedAt ? fmtDate(d.updatedAt) : ""}
            </p>
          </div>
          <ShareButton path={path} />
        </div>

        <div className="photo-pair">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photo/${d.id}`} alt={`Delivery photo at ${d.orgName}`} />
          <div>
            {donor ? (
              <>
                <div className="title" style={{ marginBottom: 8 }}>{donor.donorName}'s items in this photo</div>
                <DonorItems d={d} donorId={donor.donorId} />
              </>
            ) : (
              <>
                <div className="title" style={{ marginBottom: 8 }}>Every product in this delivery</div>
                <ItemChecks checks={r.vision.itemChecks} />
              </>
            )}
          </div>
        </div>

        {d.thankYouNote && (
          <div className="quote">
            <div className="from">From {d.orgName}</div>
            {d.thankYouNote}
          </div>
        )}
      </div>

      <div className="grid">
        <section className="card">
          <h2>What we checked</h2>
          <ul className="checks">
            {passed(d).map((t, i) => <li key={i}><span className="ok-i">✓</span>{t}</li>)}
          </ul>
        </section>
        <section className="card">
          <h2>What a photo can't prove</h2>
          <ul className="checks">
            {receiptLimits(d).map((t, i) => <li key={i}><span className="warn-i">!</span>{t}</li>)}
          </ul>
        </section>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Receipt details</h2>
        <dl className="kv">
          <dt>Receipt</dt><dd>{d.id}</dd>
          <dt>Order</dt><dd>{d.orderCode} · {d.supplier}</dd>
          <dt>Checked at</dt><dd>{d.updatedAt}</dd>
          <dt>Score</dt><dd>{r.decision.score}/100</dd>
          <dt>Photo SHA-256</dt><dd>{d.photoSha256 ?? "n/a"}</dd>
          <dt>Photo fingerprint</dt><dd>{r.integrity.hash} (dHash, catches reuse)</dd>
          <dt>Models</dt>
          <dd>{r.models ? `vision ${r.vision.model ?? r.models.vision} · checklist ${r.models.reasoning} · decision ${r.decision.model ?? r.models.reasoning} · note draft ${r.models.writer}, on Nebius Token Factory` : "Demo mode: models simulated"}</dd>
        </dl>
        <p className="sub" style={{ marginBottom: 0 }}>
          Checked by <Link href="/">Verified Delivery Copilot</Link>, open source under MIT. Machine-readable:{" "}
          <a href={`/api/receipts/${d.id}`}>receipt JSON</a> (format delivery-receipt/v1).
        </p>
      </section>
    </main>
  );
}
