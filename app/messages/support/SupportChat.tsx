"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SUPPORT_CATEGORIES } from "@/lib/support/constants";

/**
 * Discussion avec le support, présentée comme n'importe quelle conversation.
 *
 * Même fenêtre, mêmes bulles, mêmes accusés de lecture, mêmes pièces jointes
 * que lorsqu'on écrit à un vendeur. La seule différence tient à
 * l'interlocuteur : « Support Deal&Co », jamais le nom de la personne qui
 * répond — qui traite un dossier ne regarde pas l'utilisateur.
 *
 * Quand aucune discussion n'est ouverte — première visite, ou dossier marqué
 * résolu — le fil ne montre pas une page vide mais une invitation au milieu de
 * l'écran. C'est le moment où quelqu'un a un problème : il ne doit pas avoir à
 * chercher où écrire.
 */

type Message = {
  id: string;
  content: string;
  fromSupport: boolean;
  createdAt: string;
  readAt?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
};

type Ticket = {
  id: string;
  subject: string;
  status: string;
  messages: Message[];
};

const CLOSED = new Set(["RESOLVED", "CLOSED"]);

export default function SupportChat({ initialTicketId }: { initialTicketId?: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  const [attaching, setAttaching] = useState(false);
  /**
   * Motif choisi avant d'écrire.
   *
   * Une question, une seule : « quel est votre problème ? ». Elle oriente le
   * dossier côté modération et évite le premier aller-retour — « bonjour, de
   * quoi s'agit-il ? » — qui fait perdre une journée à tout le monde.
   */
  const [category, setCategory] = useState<string | null>(null);
  /** Discussions closes, consultables : l'historique de ses échanges. */
  const [history, setHistory] = useState<
    { id: string; subject: string; category: string; status: string; lastMessageAt: string }[]
  >([]);
  const [reading, setReading] = useState<Ticket | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  /** Charge un fil précis et l'affiche s'il est encore ouvert. */
  const openTicket = useCallback(async (id: string) => {
    const data = await fetch(`/api/support/tickets/${id}`).then((r) => r.json());
    // Discussion close : on n'y retourne pas. L'écran affiche « démarrer une
    // discussion », et l'ancien échange reste consultable dans l'historique,
    // en dessous. Rouvrir automatiquement un dossier réglé donnait un fil
    // qu'on ne pouvait ni poursuivre ni quitter.
    setTicket(data.ticket && !CLOSED.has(data.ticket.status) ? data.ticket : null);
  }, []);

  /** Les discussions closes, pour la liste d'historique. */
  const refreshHistory = useCallback(async () => {
    const listed = await fetch("/api/support/tickets").then((r) => r.json());
    const tickets: { id: string; status: string }[] = listed.tickets ?? [];
    setHistory(tickets.filter((row) => CLOSED.has(row.status)).slice(0, 10) as never);
    return tickets;
  }, []);

  const load = useCallback(async () => {
    try {
      // Sans identifiant précis : la discussion la plus récente qui soit encore
      // ouverte. Une discussion résolue n'est pas réactivée en silence.
      const tickets = await refreshHistory();
      const target =
        initialTicketId ?? tickets.find((row) => !CLOSED.has(row.status))?.id ?? null;

      if (!target) {
        setTicket(null);
        return;
      }
      await openTicket(target);
    } catch {
      setError("Impossible de charger la discussion");
    } finally {
      setLoading(false);
    }
  }, [initialTicketId, openTicket, refreshHistory]);

  useEffect(() => {
    void load();
  }, [load]);

  // Rafraîchissement régulier, comme une conversation ordinaire : une réponse
  // du support doit apparaître sans recharger la page.
  useEffect(() => {
    if (!ticket) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/support/tickets/${ticket.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.ticket) return;
          // Clôture décidée pendant qu'on regarde l'écran : on bascule sur
          // l'accueil du support et l'échange rejoint l'historique, au lieu de
          // laisser une conversation figée dans laquelle on peut encore taper.
          if (CLOSED.has(d.ticket.status)) void load();
          else setTicket(d.ticket);
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [ticket?.id, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  async function attach(file: File, ticketId: string) {
    setAttaching(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("ticketId", ticketId);
      const res = await fetch("/api/support/attachment", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Envoi du fichier impossible");
      setAttachment({ url: data.url, name: data.name, type: data.type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi du fichier impossible");
    } finally {
      setAttaching(false);
    }
  }

  /** Première prise de contact : crée la discussion avec le message écrit. */
  async function startConversation(first: string) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Le sujet reprend le début du message : demander un objet avant même
        // d'avoir expliqué son problème est une barrière inutile.
        body: JSON.stringify({
          subject: first.slice(0, 60),
          message: first,
          category: category ?? "autre",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Envoi impossible");
      setText("");
      setCategory(null);
      // On bascule sur le fil avec ce que le serveur vient de créer, sans
      // repasser par la liste : l'enchaînement précédent — recharger la liste,
      // puis le ticket — laissait revenir l'écran « démarrer une discussion »
      // une seconde entre les deux, et donnait l'impression d'un bug.
      if (data.ticket?.id) await openTicket(data.ticket.id);
      void refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content && !attachment) return;

    if (!ticket || CLOSED.has(ticket.status)) {
      await startConversation(content);
      return;
    }

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          attachmentUrl: attachment?.url ?? null,
          attachmentType: attachment?.type ?? null,
          attachmentName: attachment?.name ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Envoi impossible");
      setText("");
      setAttachment(null);
      await openTicket(ticket.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  }

  const conversationOpen = ticket && !CLOSED.has(ticket.status);

  return (
    <div
      className="bg-[#f8f9fc] text-on-surface flex flex-col"
      style={{ position: "fixed", inset: 0, width: "100%", maxWidth: "100vw", overflow: "hidden" }}
    >
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-b border-slate-100 z-40 px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link
          href="/messages"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[#2f6fb8]">arrow_back</span>
        </Link>

        <div className="w-10 h-10 rounded-full bg-[#2f6fb8]/10 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-[#2f6fb8]">support_agent</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <h2 className="font-extrabold text-[#2f6fb8] truncate text-base">Support Deal&amp;Co</h2>
            <span
              className="material-symbols-outlined text-[#00a67e] text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified
            </span>
          </div>
          <p className="text-[10px] text-slate-500 truncate font-medium">
            {conversationOpen ? "Notre équipe vous répond sous 24 h" : "Une question ? Écrivez-nous"}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4">
        <div className="max-w-3xl mx-auto py-4 flex flex-col gap-4">
          {loading && <p className="text-center text-sm text-slate-400 py-10">Chargement…</p>}

          {!loading && !conversationOpen && (
            /* Invitation au centre du fil : c'est le moment où quelqu'un a un
               problème, il ne doit pas chercher où écrire. */
            <div className="flex flex-col items-center justify-center text-center py-10 px-6">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-[#2f6fb8]/10">
                <span className="material-symbols-outlined text-[30px] text-[#2f6fb8]">forum</span>
              </span>
              <h3 className="mt-4 text-lg font-extrabold">Démarrer une discussion avec le support</h3>

              {!category ? (
                <>
                  <p className="mt-2 max-w-sm text-sm text-slate-500 leading-relaxed">
                    Quel est votre problème ?
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {SUPPORT_CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:border-[#2f6fb8] hover:text-[#2f6fb8]"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 max-w-sm text-sm text-slate-500 leading-relaxed">
                    <strong className="text-slate-700">
                      {SUPPORT_CATEGORIES.find((c) => c.value === category)?.label}
                    </strong>{" "}
                    — décrivez votre problème ci-dessous. Vous pourrez joindre photos, vidéos ou
                    documents une fois la discussion ouverte.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCategory(null)}
                    className="mt-2 text-xs font-bold text-slate-400 underline"
                  >
                    Changer de motif
                  </button>

                  {/* Sans cette flèche, on cherchait où écrire : l'écran vide
                      ne désignait rien, et le champ du bas ressemblait à une
                      barre de navigation. */}
                  <p className="mt-8 flex items-center gap-2 rounded-full bg-[#2f6fb8]/10 px-4 py-2 text-sm font-bold text-[#2f6fb8]">
                    <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                    Écrivez votre message dans le champ en bas de l'écran
                  </p>
                </>
              )}

              {/* Historique : les discussions closes restent consultables. Un
                  utilisateur qui revient six mois plus tard doit pouvoir
                  relire ce qui avait été décidé. */}
              {history.length > 0 && (
                <div className="mt-10 w-full max-w-sm text-left">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Discussions précédentes
                  </p>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
                    {history.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() =>
                            fetch(`/api/support/tickets/${h.id}`)
                              .then((r) => r.json())
                              .then((d) => setReading(d.ticket ?? null))
                              .catch(() => {})
                          }
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined text-[18px] text-slate-400">history</span>
                          <span className="min-w-0 flex-1">
                            {/* Le motif, pas le premier message : « Sécurité,
                                arnaque » se retrouve dans une liste, « bonjour
                                j'ai un souci avec… » non. */}
                            <span className="block truncate text-sm font-semibold">
                              {SUPPORT_CATEGORIES.find((c) => c.value === h.category)?.label ??
                                h.subject}
                            </span>
                            <span className="block text-[11px] text-slate-400">
                              Résolue le{" "}
                              {new Date(h.lastMessageAt).toLocaleDateString("fr-FR", {
                                day: "numeric", month: "long", year: "numeric",
                              })}
                            </span>
                          </span>
                          <span className="material-symbols-outlined text-[18px] text-slate-300">chevron_right</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {conversationOpen &&
            ticket.messages.map((m) => <Bubble key={m.id} m={m} />)}
          <div ref={bottomRef} />
        </div>
      </div>

      <div
        className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-4 pt-3 z-40"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        {error && <p className="max-w-3xl mx-auto mb-2 text-xs font-semibold text-[#ba1a1a]">{error}</p>}

        {attachment && (
          <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2 rounded-xl bg-[#f1f3f5] px-3 py-2 text-sm">
            <span className="material-symbols-outlined text-[18px] text-[#2f6fb8]">attach_file</span>
            <span className="flex-1 truncate font-semibold">{attachment.name}</span>
            <button type="button" onClick={() => setAttachment(null)} className="text-slate-400 hover:text-[#ba1a1a]">
              ×
            </button>
          </div>
        )}

        <form onSubmit={send} className="max-w-3xl w-full mx-auto flex items-center gap-3">
          {/* La pièce jointe suppose une discussion ouverte : le fichier est
              rattaché à un dossier, qui n'existe pas encore au premier message. */}
          {conversationOpen && (
            <label
              className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-[#f1f3f5] text-slate-500 hover:text-[#2f6fb8]"
              title="Joindre une photo, une vidéo ou un document"
            >
              <span className="material-symbols-outlined text-[20px]">
                {attaching ? "hourglass_empty" : "attach_file"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f && ticket) void attach(f, ticket.id);
                }}
              />
            </label>
          )}

          <div className="flex-1 flex items-center bg-[#f1f3f5] rounded-full px-5 py-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#2f6fb8]/10 transition-all">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!conversationOpen && !category}
              className="flex-1 bg-transparent border-none focus:ring-0 text-base outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
              placeholder={
                conversationOpen
                  ? "Écrivez un message..."
                  : category
                    ? "Écrivez ici : décrivez votre problème…"
                    : "Choisissez d'abord un motif ci-dessus"
              }
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={sending || attaching || (!conversationOpen && !category) || (!text.trim() && !attachment)}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#2f6fb8] text-white disabled:opacity-40"
            aria-label="Envoyer"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </div>

      {/* Archive ouverte : lecture seule, par-dessus le fil courant. Rouvrir un
          dossier clos en écrivant dedans mélangerait deux problèmes distincts. */}
      {reading && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#f8f9fc]">
          <header className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-4 py-3 flex items-center gap-3 shadow-sm">
            <button
              type="button"
              onClick={() => setReading(null)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50"
              aria-label="Fermer"
            >
              <span className="material-symbols-outlined text-[#2f6fb8]">arrow_back</span>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-extrabold text-[#2f6fb8]">{reading.subject}</h2>
              <p className="text-[10px] font-medium text-slate-500">Discussion terminée — lecture seule</p>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-4 py-4">
              {reading.messages.map((m) => (
                <Bubble key={m.id} m={m} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Une bulle, utilisée par le fil en cours comme par les archives.
 *
 * Relire une discussion close doit donner exactement ce qu'on avait sous les
 * yeux à l'époque : mêmes bulles, mêmes pièces jointes. Un historique reformaté
 * en liste de citations ne se relit pas.
 */
function Bubble({ m }: { m: Message }) {
  const mine = !m.fromSupport;
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
                <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine && (
                    <div className="w-8 h-8 rounded-full bg-[#2f6fb8]/10 flex items-center justify-center flex-shrink-0 self-end mb-5">
                      <span className="material-symbols-outlined text-[16px] text-[#2f6fb8]">support_agent</span>
                    </div>
                  )}
                  <div className={`max-w-[78%] flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                    <div
                      className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        mine
                          ? "bg-[#1a5a9e] text-white rounded-[20px] rounded-br-[5px]"
                          : "bg-white text-on-surface rounded-[20px] rounded-bl-[5px]"
                      }`}
                    >
                      {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                      {m.attachmentUrl && (
                        <a
                          href={m.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-2 block overflow-hidden rounded-xl ${mine ? "bg-white/15" : "bg-slate-50"}`}
                        >
                          {m.attachmentType?.startsWith("video/") ? (
                            <video
                              src={m.attachmentUrl}
                              controls
                              playsInline
                              className="max-h-56 w-full"
                            />
                          ) : m.attachmentType?.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.attachmentUrl}
                              alt={m.attachmentName ?? "Pièce jointe"}
                              className="max-h-56 w-full object-cover"
                            />
                          ) : (
                            <span className="flex items-center gap-2 px-3 py-2 text-sm font-semibold">
                              <span className="material-symbols-outlined text-[18px]">description</span>
                              <span className="truncate">{m.attachmentName ?? "Document"}</span>
                            </span>
                          )}
                        </a>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold px-1 uppercase tracking-tight">
                      {time(m.createdAt)}
                      {mine && (
                        /* Une coche : parti d'ici. Deux : enregistré côté
                           support, donc dans la file d'un modérateur. Deux
                           bleues : ouvert par quelqu'un. Le message existe en
                           base dès qu'il revient du serveur, la deuxième coche
                           est donc acquise — c'est la lecture qui se mérite. */
                        <span
                          className={`inline-flex items-center ${m.readAt ? "text-[#4fc3f7]" : "text-slate-400"}`}
                          title={m.readAt ? "Lu par le support" : "Remis au support"}
                        >
                          <span className="material-symbols-outlined text-[13px] leading-none">check</span>
                          <span className="material-symbols-outlined text-[13px] leading-none -ml-[7px]">check</span>
                        </span>
                      )}
                    </span>
                  </div>
                </div>
  );
}
