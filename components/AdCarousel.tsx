"use client";

import { useEffect, useState } from "react";

type Ad = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  destinationUrl: string;
};

export default function AdCarousel({ ads }: { ads: Ad[] }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (ads.length <= 1) return;

    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % ads.length);
        setVisible(true);
      }, 400);
    }, 10000);

    return () => clearInterval(interval);
  }, [ads.length]);

  // Track impression when ad becomes visible
  useEffect(() => {
    if (!ads[current]?.id) return;
    fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ads[current].id, type: "impression" }),
    }).catch(() => {});
  }, [current, ads]);

  if (!ads.length) return null;

  const ad = ads[current];

  function handleClick() {
    fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ad.id, type: "click" }),
    }).catch(() => {});
  }

  return (
    <section className="px-6 max-w-7xl mx-auto mb-2">
      <a
        href={ad.destinationUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}
        className="flex items-center gap-4 bg-white border border-[#c7c5d4] rounded-2xl p-3 hover:shadow-md transition-shadow"
      >
        <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-surface-container-low">
          <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
          <span className="absolute top-1 left-1 bg-[#2f6fb8] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            Pub
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-on-surface line-clamp-1">{ad.title}</p>
          <p className="text-xs text-outline mt-0.5 line-clamp-2">{ad.description}</p>
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <span className="material-symbols-outlined text-outline text-lg">open_in_new</span>
          {ads.length > 1 && (
            <div className="flex gap-1">
              {ads.map((_, i) => (
                <span
                  key={i}
                  className={`block w-1 h-1 rounded-full transition-colors ${i === current ? "bg-primary" : "bg-outline-variant"}`}
                />
              ))}
            </div>
          )}
        </div>
      </a>
    </section>
  );
}
