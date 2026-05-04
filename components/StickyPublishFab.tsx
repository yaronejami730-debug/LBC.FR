"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

type Props = {
  categoryId?: string;
};

export default function StickyPublishFab({ categoryId }: Props) {
  const { data: session, status } = useSession();
  if (status === "loading") return null;
  if (session?.user) return null;

  const target = categoryId ? `/post?category=${categoryId}` : "/post";
  const href = `/login?callbackUrl=${encodeURIComponent(target)}`;

  return (
    <Link
      href={href}
      aria-label="Publier mon annonce gratuitement"
      className="md:hidden fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 px-5 py-3.5 bg-primary text-white rounded-full font-bold text-sm shadow-2xl shadow-primary/30 active:scale-95 transition-transform"
    >
      <span className="material-symbols-outlined text-xl">add_circle</span>
      Publier
    </Link>
  );
}
