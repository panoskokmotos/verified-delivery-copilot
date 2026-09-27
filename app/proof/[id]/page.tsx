import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allItems, itemCount } from "../../../lib/items";
import { costOf, usd } from "../../../lib/prices";
import { verified } from "../../../lib/verified";
import { receiptLimits } from "../../../lib/receipt";
import { getDelivery } from "../../../lib/store";
import type { Delivery } from "../../../lib/types";
import { DonorItems } from "../../donor-items";
import { fmtDate, photoUrl } from "../../labels";
import { Questions } from "../../questions";
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
  // Only a pass gets a tick. Missing items and a failed check are listed under what the photo can't prove.
  const out = seen > 0 && verified(r) ? [`${seen} of ${r.vision.itemChecks.length} products fully visible and counted against what donors sent.`] : [];
  if (!r.integrity.aiLabel) out.push("No AI-generated content label in the file.");
  if (!r.integrity.duplicateOf) out.push("The photo doesn't match any earlier delivery photo.");
  if (r.vision.aiSuspicion === "none") out.push("No visual signs of an AI-generated image.");
  if (r.capture?.inApp) out.push("Taken live with the app's camera, not picked from a gallery.");
  if (r.vision.slip?.matchesOrder) out.push(`The packing slip in the photo shows this delivery's order, ${r.vision.slip.orderCode}.`);
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
  }  // Priced from the stored usage, so older receipts pick up prices added later.
  const cost = r.usage ? costOf(r.usage).usd : r.cost?.usd;


  const path = `/proof/${d.id}${donor ? `?donor=${donor.donorId}` : ""}`;
  const back = donor ? { href: `/donor/${donor.donorId}`, label: `← ${donor.donorName}'s gifts` } : { href: "/stats", label: "← All deliveries" };
  const seenCount = r.vision.itemChecks.filter((c) => c.status === "seen").length;
  const complete = seenCount === r.vision.itemChecks.length;
  return (
    <main>
      <nav className="crumbs">
        <Link className="back" href={back.href}>{back.label}</Link>
        <span>
          <Link className="back" href="/">Home</Link> · <Link className="back" href={`/api/receipts/${d.id}`}>JSON</Link>
        </span>
      </nav>
      <div className="card">
        <div className="receipt-head">
          <div>
            {!verified(r) ? (
              <span className="pill danger">⚠ Not verified: sent without passing the photo check</span>
            ) : complete ? (
              <span className="pill success">✓ Delivery verified</span>
            ) : (
              <span className="pill warning">✓ Genuine photo · {seenCount} of {r.vision.itemChecks.length} products fully visible</span>
            )}
            {r.capture?.inApp && <span className="pill success" style={{ marginLeft: 6 }}>📸 Taken live in the app</span>}
            {d.replaced?.length ? (
              <p className="replaced">
                🔁 The nonprofit replaced an earlier photo on {fmtDate(d.updatedAt ?? "")}
                {d.replaced.length > 1 ? ` (${d.replaced.length} replacements so far)` : ""}. The earlier photo{" "}
                {d.replaced.at(-1)!.passedCheck ? "had passed" : "had not passed"} the check.
              </p>
            ) : null}
            {r.vision.slip?.matchesOrder && <span className="pill success" style={{ marginLeft: 6 }}>🧾 Packing slip matches order</span>}
            <h1 style={{ fontSize: 26, margin: "10px 0 4px" }}>{d.orgName}</h1>
            <p className="sub" style={{ margin: 0 }}>
              {d.city} · {itemCount(allItems(d))} items from {d.donations.length} donors · arrived {fmtDate(d.arrivesAt)} · checked {d.updatedAt ? fmtDate(d.updatedAt) : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ShareButton path={path} />
            <a className="btn subtle" href={photoUrl(d, true)}>Download photo</a>
          </div>
        </div>

        <div className="photo-pair">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(d)} alt={`Delivery photo at ${d.orgName}`} />
          {/* On a photo that failed the check, per-item ticks are the model's reading, not a verification: grey them. */}
          <div className={verified(r) ? "" : "muted"}>
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

      {r.vision.slip?.visible && r.vision.slip.lines.length > 0 && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>Packing slip in the photo</h2>
          <p className="sub" style={{ marginTop: 0 }}>Order {r.vision.slip.orderCode ?? "not readable"}{r.vision.slip.matchesOrder ? ", matches this delivery" : ""}</p>
          <ul className="checks">
            {r.vision.slip.lines.map((l, i) => <li key={i}><span className="ok-i">·</span>{l.quantity ?? "?"} × {l.name}</li>)}
          </ul>
        </section>
      )}

      {(d.questions ?? []).some((q) => q.answer) || donor ? (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>Questions and answers</h2>
          <Questions delivery={d} as={donor ? { donorId: donor.donorId } : "public"} />
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Receipt details</h2>
        <dl className="kv">
          <dt>Receipt</dt><dd>{d.id}</dd>
          <dt>Order</dt><dd>{d.orderCode} · {d.supplier}</dd>
          <dt>Checked at</dt><dd>{d.updatedAt}</dd>
          <dt>Score</dt><dd>{r.decision.score}/100</dd>
          <dt>Cost of this check</dt>
          <dd>{cost != null ? usd(cost) : "n/a"}</dd>
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
