"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function formatCountdown(ms: number) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}

export default function ExpiryTimer({
  listingId,
  createdAt,
}: {
  listingId: string;
  createdAt: string;
}) {
  const expiresAt = new Date(new Date(createdAt).getTime() + 90 * 24 * 60 * 60 * 1000);
  const [countdown, setCountdown] = useState(formatCountdown(expiresAt.getTime() - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(formatCountdown(expiresAt.getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const urgent = countdown.days < 7;
  const color = countdown.expired ? "red" : urgent ? "amber" : "blue";

  return (
    <div className={`px-4 py-3 rounded-2xl border mt-4 ${
      color === "red"   ? "bg-red-50 border-red-100" :
      color === "amber" ? "bg-amber-50 border-amber-100" :
                          "bg-[#f5f2ff] border-[#d5e3fc]"
    }`}>
      {/* Ligne 1 : icône + compteur */}
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined text-[18px] flex-shrink-0 ${
          color === "red" ? "text-red-500" : color === "amber" ? "text-amber-500" : "text-[#2f6fb8]"
        }`}>schedule</span>

        <div className="flex-1 min-w-0">
          {countdown.expired ? (
            <p className="text-sm font-bold text-red-600">Annonce expirée</p>
          ) : (
            <>
              <p className={`text-[11px] font-semibold mb-1 ${color === "amber" ? "text-amber-600" : "text-[#2f6fb8]"}`}>
                Expiration dans
              </p>
              <div className="flex items-center gap-1 font-mono flex-wrap">
                {[
                  { v: countdown.days, label: "j" },
                  { v: countdown.hours, label: "h" },
                  { v: countdown.minutes, label: "m" },
                  { v: countdown.seconds, label: "s" },
                ].map(({ v, label }) => (
                  <span key={label} className={`text-[11px] font-black px-1.5 py-0.5 rounded-lg ${
                    color === "amber" ? "bg-amber-100 text-amber-700" : "bg-[#d5e3fc] text-[#2f6fb8]"
                  }`}>
                    {String(v).padStart(2, "0")}{label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ligne 2 : bouton Republier — toujours visible */}
      <div className="mt-2.5 pt-2.5 border-t border-black/5">
        <Link
          href={`/annonce/${listingId}/republier`}
          className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${
            color === "red" ? "text-red-600 hover:text-red-700" :
            color === "amber" ? "text-amber-600 hover:text-amber-700" :
            "text-[#2f6fb8] hover:text-[#1a5a9e]"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">refresh</span>
          Republier cette annonce
        </Link>
      </div>
    </div>
  );
}
