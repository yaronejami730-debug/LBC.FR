"use client";

/**
 * Tracker d'événements monté à la racine — émet un `page_view` à chaque
 * changement de route. Exclut les chemins admin (inutile + bruit pour le
 * moteur comportemental). Aucun DOM rendu.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/event-tracker";

export default function EventTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/admin")) return;
    if (pathname.startsWith("/api/")) return;
    track("page_view");
  }, [pathname]);
  return null;
}
