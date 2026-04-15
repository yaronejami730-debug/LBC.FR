"use client";

import { useState } from "react";

export default function BrandBadge({ name, logo }: { name: string; logo: string }) {
  const [err, setErr] = useState(false);

  return (
    <div className="flex items-center gap-3 mb-1">
      {!err && (
        <img
          src={logo}
          alt={name}
          width={52}
          height={52}
          onError={() => setErr(true)}
          className="object-contain rounded-xl bg-slate-50 p-1.5 border border-slate-100 shrink-0"
          style={{ width: 52, height: 52 }}
        />
      )}
      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{name}</span>
    </div>
  );
}
