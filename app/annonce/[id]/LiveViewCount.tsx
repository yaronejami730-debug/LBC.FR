"use client";

import { useEffect, useState } from "react";

export default function LiveViewCount({
  listingId,
  initialCount,
}: {
  listingId: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/listings/${listingId}/views/stream`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { viewCount: number };
        setCount((prev) => {
          if (data.viewCount !== prev) {
            setPulse(true);
            setTimeout(() => setPulse(false), 600);
          }
          return data.viewCount;
        });
      } catch {}
    };

    return () => es.close();
  }, [listingId]);

  return (
    <div className="inline-flex items-center gap-1.5 bg-primary/8 text-primary px-3 py-1.5 rounded-full text-xs font-semibold">
      <span
        className={`w-1.5 h-1.5 rounded-full bg-green-500 ${
          pulse ? "scale-150" : ""
        } transition-transform duration-300`}
      />
      <span className="material-symbols-outlined text-[14px]">visibility</span>
      <span className={pulse ? "text-primary font-extrabold" : ""}>
        {count.toLocaleString("fr-FR")} vue{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
