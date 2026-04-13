"use client";
import { usePresence } from "@/hooks/usePresence";

// Composant silencieux — enregistre la présence du visiteur en temps réel
export default function VisitorTracker() {
  usePresence("platform", "user");
  return null;
}
