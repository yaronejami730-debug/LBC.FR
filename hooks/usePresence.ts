"use client";
import { useEffect, useState, useRef } from "react";
import { supabaseClient } from "@/lib/supabase-presence";

const HEARTBEAT_INTERVAL = 1_000; // 1s — temps réel instantané

function getSessionId(): string {
  let uid = sessionStorage.getItem("dealco_uid");
  if (!uid) {
    uid = crypto.randomUUID();
    sessionStorage.setItem("dealco_uid", uid);
  }
  return uid;
}

export function usePresence(channel: string, role: "user" | "admin" = "user"): number {
  const [count, setCount] = useState(0);
  const sessionId = useRef<string | null>(null);

  useEffect(() => {
    sessionId.current = getSessionId();
    const sid = sessionId.current;

    const sendHeartbeat = async () => {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sid, channel, role }),
        });
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {
        // silencieux si réseau indisponible
      }
    };

    const fetchCount = async () => {
      try {
        const res = await fetch(`/api/presence?channel=${encodeURIComponent(channel)}`);
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {}
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Realtime Supabase : écoute les changements sur presence_sessions
    const sub = supabaseClient
      .channel(`presence_realtime_${channel}_${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presence_sessions",
          filter: `channel=eq.${channel}`,
        },
        fetchCount
      )
      .subscribe();

    const handleUnload = () => {
      navigator.sendBeacon(
        "/api/presence",
        new Blob(
          [JSON.stringify({ session_id: sid, channel, role })],
          { type: "application/json" }
        )
      );
    };

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") handleUnload();
    });

    return () => {
      clearInterval(interval);
      supabaseClient.removeChannel(sub);
      fetch("/api/presence", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, channel, role }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [channel]);

  return count;
}
