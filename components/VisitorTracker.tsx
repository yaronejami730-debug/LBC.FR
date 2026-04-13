"use client";
import { usePathname } from "next/navigation";
import { usePresence } from "@/hooks/usePresence";

function Tracker() {
  usePresence("platform", "user");
  return null;
}

// Ne compte pas les admins comme visiteurs
export default function VisitorTracker() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <Tracker />;
}
