import { donorShare } from "../lib/items";
import type { Delivery } from "../lib/types";

/**
 * A donor's own items next to the delivery photo: numbered, where each sits in the photo, and how
 * many of those shown are theirs. The photo can't say which physical bag came from whom, so we say
 * "you gave 2 of these 4" rather than pointing at one.
 */
export function DonorItems({ d, donorId }: { d: Delivery; donorId: string }) {
  const share = donorShare(d, donorId);
  return (
    <ol className="yours">
      {share.map(({ item, check, total }, n) => (
        <li key={n} className={check?.status ?? "unclear"}>
          <span className="num">{n + 1}</span>
          <div>
            <div className="title">{item.name}</div>
            <div className="sub">
              You gave {item.quantity} of {total === item.quantity ? "the" : "these"} {total}
              {check ? ` · ${check.seen ?? "?"} of ${check.expected} visible` : ""}
            </div>
            {check?.where && <div className="where">📍 {check.where}</div>}
          </div>
          <span className="mark">{check?.status === "seen" ? "✓" : check?.status === "missing" ? "✕" : "!"}</span>
        </li>
      ))}
    </ol>
  );
}
