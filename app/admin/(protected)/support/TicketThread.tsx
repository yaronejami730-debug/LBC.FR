"use client";

import { useState, useTransition } from "react";
import { assignTicket, replyToTicket, setTicketPriority, setTicketStatus } from "./actions";

export type ThreadMessage = {
  id: string;
  content: string;
  fromSupport: boolean;
  createdAt: string;
  sender: { id: string; name: string | null };
};

export type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  lastMessageAt: string;
  unreadForAdmin: number;
  assignedTo: { id: string; name: string | null } | null;
  listing: { id: string; title: string } | null;
  user: {
    id: string;
    name: string;
    email: string;
    isPro: boolean;
    createdAt: string;
    bannedAt: string | null;
    _count: { listings: number };
  };
  messages: ThreadMessage[];
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "À traiter",
  WAITING_USER: "En attente du client",
  RESOLVED: "Résolu",
  CLOSED: "Clos",
};

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-800",
  WAITING_USER: "bg-sky-100 text-sky-800",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

/**
 * Un fil de support, côté modération.
 *
 * La fiche du client est affichée à côté de la conversation — ancienneté,
 * nombre d'annonces, sanction éventuelle. Répondre sans savoir à qui l'on parle
 * conduit à demander au client ce que la base sait déjà.
 */
export default function TicketThread({ ticket }: { ticket: Ticket }) {
  const [open, setOpen] = useState(ticket.unreadForAdmin > 0);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError("");
    start(async () => {
      const res = await fn().catch((e) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : "Action impossible",
      }));
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <article className="bg-white border border-[#eceef0] rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-slate-50"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900">{ticket.subject}</span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                STATUS_TONE[ticket.status] ?? "bg-slate-100 text-slate-600"
              }`}
            >
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>
            {ticket.priority === "HIGH" && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                Prioritaire
              </span>
            )}
            {ticket.unreadForAdmin > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2f6fb8] text-white">
                {ticket.unreadForAdmin} nouveau{ticket.unreadForAdmin > 1 ? "x" : ""}
              </span>
            )}
          </span>
          <span className="block text-sm text-slate-500 mt-1">
            {ticket.user.name} · {ticket.user.email}
            {ticket.user.isPro ? " · pro" : ""}
            {ticket.user.bannedAt ? " · compte banni" : ""}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5">
            {ticket.category} · {ticket.messages.length} message
            {ticket.messages.length > 1 ? "s" : ""} · dernier le{" "}
            {new Date(ticket.lastMessageAt).toLocaleString("fr-FR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
            {ticket.assignedTo ? ` · pris par ${ticket.assignedTo.name ?? "un modérateur"}` : ""}
          </span>
        </span>
        <span className="material-symbols-outlined text-slate-400">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="border-t border-[#eceef0] px-5 py-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {ticket.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      m.fromSupport ? "bg-[#2f6fb8] text-white ml-auto" : "bg-slate-100 text-slate-900"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.fromSupport ? "text-white/70" : "text-slate-500"}`}>
                      {m.fromSupport ? (m.sender.name ?? "Support") : ticket.user.name} ·{" "}
                      {new Date(m.createdAt).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const content = reply.trim();
                  if (content.length < 2) return;
                  setReply("");
                  setSent(true);
                  run(() => replyToTicket(ticket.id, content));
                }}
                className="mt-3 flex items-end gap-2"
              >
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder="Votre réponse au client…"
                  className="flex-1 rounded-xl border border-[#eceef0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/20"
                />
                <button
                  type="submit"
                  disabled={pending || reply.trim().length < 2}
                  className="rounded-full bg-[#2f6fb8] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {pending ? "Envoi…" : "Répondre"}
                </button>
              </form>
              {sent && !pending && !error && (
                <p className="mt-2 text-xs font-semibold text-emerald-700">
                  Réponse envoyée — le client reçoit une notification et un email.
                </p>
              )}
              {error && <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p>}
            </div>

            <aside className="space-y-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Le client
                </p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{ticket.user.name}</p>
                <p className="text-xs text-slate-500">
                  Inscrit le {new Date(ticket.user.createdAt).toLocaleDateString("fr-FR")}
                </p>
                <p className="text-xs text-slate-500">
                  {ticket.user._count.listings} annonce{ticket.user._count.listings > 1 ? "s" : ""}
                </p>
                <a
                  href={`/admin/clients/${ticket.user.id}`}
                  className="mt-2 inline-block text-xs font-bold text-[#2f6fb8]"
                >
                  Ouvrir sa fiche
                </a>
              </div>

              {ticket.listing && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Annonce concernée
                  </p>
                  <a
                    href={`/annonce/${ticket.listing.id}`}
                    className="text-xs font-bold text-[#2f6fb8] mt-1 block"
                  >
                    {ticket.listing.title}
                  </a>
                </div>
              )}

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => run(() => assignTicket(ticket.id, !ticket.assignedTo))}
                  disabled={pending}
                  className="w-full rounded-full border border-[#eceef0] px-3 py-2 text-xs font-bold text-slate-600 hover:border-[#2f6fb8]"
                >
                  {ticket.assignedTo ? "Relâcher le dossier" : "Je m'en occupe"}
                </button>
                <button
                  type="button"
                  onClick={() => run(() => setTicketStatus(ticket.id, "RESOLVED"))}
                  disabled={pending}
                  className="w-full rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                >
                  Marquer résolu
                </button>
                <button
                  type="button"
                  onClick={() => run(() => setTicketStatus(ticket.id, "CLOSED"))}
                  disabled={pending}
                  className="w-full rounded-full border border-[#eceef0] px-3 py-2 text-xs font-bold text-slate-600 hover:border-rose-300"
                >
                  Clore sans suite
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(() => setTicketPriority(ticket.id, ticket.priority === "HIGH" ? "NORMAL" : "HIGH"))
                  }
                  disabled={pending}
                  className="w-full rounded-full border border-[#eceef0] px-3 py-2 text-xs font-bold text-slate-600 hover:border-[#2f6fb8]"
                >
                  {ticket.priority === "HIGH" ? "Priorité normale" : "Marquer prioritaire"}
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </article>
  );
}
