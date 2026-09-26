import { itemCount, itemValue } from "../lib/items";
import type { NeedItem } from "../lib/types";
import { money, productIcon } from "./labels";

/** Products in a delivery as cards, with the item count and value above them. */
export function Products({ items }: { items: NeedItem[] }) {
  const value = itemValue(items);
  return (
    <>
      <div className="meta-row">
        Items included <span className="pill">{itemCount(items)}</span>
        {value > 0 && <>Value <span className="pill">{money(value)}</span></>}
      </div>
      <div className="products">
        {items.map((i, n) => (
          <div className="product" key={n}>
            <span className="qty">×{i.quantity}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="img">{i.image ? <img src={i.image} alt={i.name} /> : productIcon(i.name)}</div>
            <div className="name">{i.name}</div>
          </div>
        ))}
      </div>
    </>
  );
}
