"use client";

export default function SignOutButton() {
  return (
    <a
      href="/api/signout"
      className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-error/30 text-error text-sm font-semibold hover:bg-error/5 transition-colors active:scale-95"
    >
      <span className="material-symbols-outlined text-base">logout</span>
      Se déconnecter
    </a>
  );
}
