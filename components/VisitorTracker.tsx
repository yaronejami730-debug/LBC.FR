"use client";

import { useEffect } from "react";

function getSessionId(): string {
  let id = sessionStorage.getItem("_vsid");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("_vsid", id);
  }
  return id;
}

export default function VisitorTracker() {
  useEffect(() => {
    const sessionId = getSessionId();

    const ping = () =>
      fetch("/api/visitors/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});

    // Register immediately
    ping();

    // Refresh every 30s
    const interval = setInterval(ping, 30_000);

    // Unregister on tab close / navigation away
    const leave = () => {
      navigator.sendBeacon(
        "/api/visitors/heartbeat",
        new Blob([JSON.stringify({ sessionId, leave: true })], { type: "application/json" })
      );
    };

    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);

    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
    };
  }, []);

  return null;
}
