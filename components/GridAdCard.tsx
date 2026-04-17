"use client";

import { useEffect, useRef } from "react";

type Props = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  destinationUrl: string;
};

export default function GridAdCard({ id, title, description, imageUrl, destinationUrl }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "impression", placement: "grid" }),
    }).catch(() => {});
  }, [id]);

  function handleClick() {
    fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "click" }),
    }).catch(() => {});
  }

  return (
    <a
      href={destinationUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="group flex flex-col bg-white rounded-xl overflow-hidden border border-[#c7c5d4] hover:shadow-md transition-all duration-200"
    >
      <div className="relative aspect-square overflow-hidden bg-surface-container-low">
        <img alt={title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" src={imageUrl} />
        <span className="absolute top-2 left-2 bg-[#2f6fb8] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          Publicité
        </span>
      </div>
      <div className="p-2.5 flex flex-col gap-0.5">
        <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{title}</p>
        <p className="text-outline text-xs line-clamp-2">{description}</p>
      </div>
    </a>
  );
}
