import type { Recall } from "../lib/types";
import { fmtDate } from "./labels";

/** The recall search result for one product: clear, or a link to the recall notice. */
export function RecallBadge({ recall }: { recall?: Recall }) {
  if (!recall) return null;
  if (recall.status === "found" && recall.source) {
    return (
      <a className="pill danger recall" href={recall.source.url} target="_blank" rel="noreferrer" title={recall.summary}>
        ⚠ Recall found
      </a>
    );
  }
  return (
    <span className="pill success recall" title={`Searched ${recall.searched.join(", ")} on ${fmtDate(recall.checkedAt)}`}>
      ✓ No recalls found
    </span>
  );
}
