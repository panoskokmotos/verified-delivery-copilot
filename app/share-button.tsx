"use client";

import { useState } from "react";

export function ShareButton({ path, label = "Copy share link" }: { path: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn subtle"
      onClick={async () => {
        const url = new URL(path, window.location.origin).toString();
        try {
          if (navigator.share) await navigator.share({ url, title: "Delivery receipt" });
          else await navigator.clipboard.writeText(url);
          setDone(true);
        } catch {
          /* share sheet closed */
        }
      }}
    >
      {done ? "Link ready ✓" : label}
    </button>
  );
}
