"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabaseClient } from "@/lib/supabase-presence";

const HEARTBEAT_INTERVAL = 5_000; // 5s — stable et suffisamment réactif

/**
 * UUID v4 avec repli : crypto.randomUUID n'existe que dans les contextes
 * sécurisés (HTTPS/localhost) et les navigateurs récents. En HTTP ou sur
 * vieux Safari, on retombe sur getRandomValues, puis sur Math.random.
 */
function uuid(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
}

function getSessionId(): string {
  let uid = sessionStorage.getItem("dealco_uid");
  if (!uid) {
    uid = uuid();
    sessionStorage.setItem("dealco_uid", uid);
  }
  return uid;
}

export function usePresence(channel: string, role: "user" | "admin" = "user"): number {
  const [count, setCount] = useState(0);
  const sessionId = useRef<string | null>(null);
  const client = useMemo(() => supabaseClient(), []);

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

    // Debounce fetchCount pour éviter la race condition quand plusieurs
    // heartbeats arrivent simultanément et déclenchent des GET en parallèle
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const fetchCountDebounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/presence?channel=${encodeURIComponent(channel)}`);
          if (res.ok) {
            const data = await res.json();
            setCount(data.count ?? 0);
          }
        } catch {}
      }, 300); // attend 300ms que la rafale se calme
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Realtime Supabase : écoute les changements sur presence_sessions
    const sub = client
      .channel(`presence_realtime_${channel}_${uuid()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presence_sessions",
          filter: `channel=eq.${channel}`,
        },
        fetchCountDebounced
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
      if (debounceTimer) clearTimeout(debounceTimer);
      client.removeChannel(sub);
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
