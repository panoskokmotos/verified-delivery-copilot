import type { NeedItem } from "../lib/types";
import { itemCount, productIcon } from "./labels";

/** The items a donor sent, as product cards. */
export function Products({ items }: { items: NeedItem[] }) {
  return (
    <>
      <div className="meta-row">
        Items included <span className="pill">{itemCount(items)}</span>
      </div>
      <div className="products">
        {items.map((i, n) => (
          <div className="product" key={n}>
            <span className="qty">×{i.quantity}</span>
            <div className="img">{productIcon(i.name)}</div>
            <div className="name">{i.name}</div>
          </div>
        ))}
      </div>
    </>
  );
}
