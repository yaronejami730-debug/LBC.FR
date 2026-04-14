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

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border mt-4 ${
      countdown.expired
        ? "bg-red-50 border-red-100"
        : urgent
        ? "bg-amber-50 border-amber-100"
        : "bg-[#f5f2ff] border-[#d5e3fc]"
    }`}>
      <span className={`material-symbols-outlined text-[20px] flex-shrink-0 ${
        countdown.expired ? "text-red-500" : urgent ? "text-amber-500" : "text-[#2f6fb8]"
      }`}>schedule</span>

      <div className="flex-1 min-w-0">
        {countdown.expired ? (
          <p className="text-sm font-bold text-red-600">Annonce expirée</p>
        ) : (
          <>
            <p className={`text-xs font-semibold mb-1 ${urgent ? "text-amber-600" : "text-[#2f6fb8]"}`}>
              Expiration dans
            </p>
            <div className="flex items-center gap-1.5 font-mono">
              {[
                { v: countdown.days, label: "j" },
                { v: countdown.hours, label: "h" },
                { v: countdown.minutes, label: "m" },
                { v: countdown.seconds, label: "s" },
              ].map(({ v, label }) => (
                <span key={label} className={`text-xs font-black px-1.5 py-0.5 rounded-lg ${
                  urgent ? "bg-amber-100 text-amber-700" : "bg-[#d5e3fc] text-[#2f6fb8]"
                }`}>
                  {String(v).padStart(2, "0")}{label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <Link
        href={`/annonce/${listingId}/republier`}
        className="flex-shrink-0 text-[12px] font-bold text-[#2f6fb8] hover:underline underline-offset-2"
      >
        Republier
      </Link>
    </div>
  );
}
