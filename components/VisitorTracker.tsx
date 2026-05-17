"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePresence } from "@/hooks/usePresence";

function Tracker() {
  usePresence("platform", "user");
  return null;
}

// Routes très visitées par les bots/visiteurs SEO : zéro intérêt à ouvrir
// une WebSocket Realtime sur ces pages. Réduit massivement le TBT.
const SEO_PREFIXES = [
  "/annonces",
  "/ville",
  "/prix",
  "/voiture",
  "/voiture-budget",
  "/comparatif",
  "/blog",
];

// Visitor tracker : ne s'active qu'après le LCP (2 s), et seulement
// sur les pages applicatives — pas sur les routes SEO ni l'admin.
export default function VisitorTracker() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const shouldTrack =
    !!pathname &&
    !pathname.startsWith("/admin") &&
    !SEO_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!shouldTrack) return;
    // Délai > LCP cible : laisse le main thread libre pour le premier paint.
    const t = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(t);
  }, [shouldTrack, pathname]);

  if (!shouldTrack || !ready) return null;
  return <Tracker />;
}
