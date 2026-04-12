"use client";

import { useEffect, useState } from "react";

type Ad = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  destinationUrl: string;
};

export default function AdRotator({ ads }: { ads: Ad[] }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (ads.length <= 1) return;
    const interval = setInterval(() => {
      // Fade out
      setVisible(false);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % ads.length);
        // Fade in
        setVisible(true);
      }, 400);
    }, 15000);
    return () => clearInterval(interval);
  }, [ads.length]);

  const ad = ads[current];

  return (
    <a
      href={ad.destinationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease-in-out",
      }}
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={ad.imageUrl}
          alt={ad.title}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-2 left-2 bg-[#15157d] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          Publicité
        </span>
        {ads.length > 1 && (
          <span className="absolute bottom-2 right-2 bg-black/40 text-white text-[9px] px-2 py-0.5 rounded-full">
            {current + 1} / {ads.length}
          </span>
        )}
      </div>
      <div className="p-4 bg-white">
        <p className="font-bold text-sm text-on-surface line-clamp-1">{ad.title}</p>
        <p className="text-xs text-outline mt-0.5 line-clamp-2">{ad.description}</p>
      </div>
    </a>
  );
}
