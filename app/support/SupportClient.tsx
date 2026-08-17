"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TicketSummary = {
  id: string;
  subject: string;
  category: string;
  status: string;
  lastMessageAt: string;
  unreadForUser: number;
  createdAt: string;
  lastMessage: { content: string; fromSupport: boolean; createdAt: string } | null;
};

type Message = {
  id: string;
  content: string;
  fromSupport: boolean;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  createdAt: string;
  sender: { id: string; name: string | null; avatar: string | null };
};

type Ticket = TicketSummary & {
  messages: Message[];
  listing: { id: string; title: string } | null;
};

const CATEGORIES = [
  { value: "compte", label: "Mon compte" },
  { value: "annonce", label: "Une annonce" },
  { value: "securite", label: "Sécurité, arnaque" },
  { value: "paiement", label: "Paiement, facturation" },
  { value: "pro", label: "Compte professionnel" },
  { value: "technique", label: "Problème technique" },
  { value: "autre", label: "Autre" },
];

const STATUS_LABELS: Record<string, string> = {
  OPEN: "En cours de traitement",
  WAITING_USER: "Réponse du support",
  RESOLVED: "Résolue",
  CLOSED: "Close",
};

const input =
  "w-full bg-surface-container-low rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30";

/**
 * Espace de discussion avec le support.
 *
 * Une conversation, pas un formulaire de contact : le formulaire envoie un
 * message dans le vide et laisse l'utilisateur surveiller sa boîte mail. Ici,
 * la demande garde un état visible, l'historique reste consultable, et la
 * réponse arrive au même endroit que la question.
 */
export default function SupportClient({ initialTicketId }: { initialTicketId?: string }) {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("autre");
  const [firstMessage, setFirstMessage] = useState("");
  const [reply, setReply] = useState("");

  const threadRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/support/tickets");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chargement impossible");
      setTickets(data.tickets);
      return data.tickets as TicketSummary[];
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const openTicket = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/support/tickets/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discussion introuvable");
      setActive(data.ticket);
      setComposing(false);
      // Le fil est lu : le compteur local suit, sans attendre un rechargement.
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, unreadForUser: 0 } : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discussion introuvable");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const list = await loadTickets();
      if (initialTicketId) await openTicket(initialTicketId);
      else if (list.length === 0) setComposing(true);
    })();
  }, [loadTickets, openTicket, initialTicketId]);

  useEffect(() => {
    // Le dernier message doit être visible sans faire défiler.
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [active]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, category, message: firstMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Envoi impossible");
      setSubject("");
      setFirstMessage("");
      await loadTickets();
      await openTicket(data.ticket.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  }

  /**
   * Pièce jointe déjà déposée, en attente d'être envoyée avec le message.
   *
   * Le fichier part dès sa sélection : attendre l'envoi du message ferait
   * patienter l'utilisateur devant un bouton figé, alors que le dépôt d'un PDF
   * de plusieurs mégaoctets prend quelques secondes.
   */
  const [attachment, setAttachment] = useState<
    { url: string; name: string; type: string } | null
  >(null);
  const [attaching, setAttaching] = useState(false);

  async function attach(file: File) {
    if (!active) return;
    setAttaching(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("ticketId", active.id);
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

  async function send(e: React.FormEvent) {
    e.preventDefault();
    // Une pièce jointe seule vaut message : « voici ma facture » n'a pas
    // besoin d'être écrit.
    if (!active || (!reply.trim() && !attachment)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${active.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: reply,
          attachmentUrl: attachment?.url ?? null,
          attachmentType: attachment?.type ?? null,
          attachmentName: attachment?.name ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Envoi impossible");
      setReply("");
      setAttachment(null);
      await openTicket(active.id);
      await loadTickets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  }

  async function resolve() {
    if (!active) return;
    await fetch(`/api/support/tickets/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    await openTicket(active.id);
    await loadTickets();
  }

  return (
    <div className="grid gap-5 md:grid-cols-[300px_1fr]">
      {/* Liste des demandes */}
      <aside className="space-y-2">
        <button
          type="button"
          onClick={() => {
            setComposing(true);
            setActive(null);
          }}
          className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white"
        >
          Nouvelle demande
        </button>

        {loading && <p className="text-sm text-outline px-1">Chargement…</p>}

        {tickets.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => openTicket(t.id)}
            className={`w-full text-left rounded-2xl border p-3.5 transition-colors ${
              active?.id === t.id ? "border-primary bg-primary/5" : "border-slate-100 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold truncate">{t.subject}</span>
                <span className="block text-xs text-outline truncate mt-0.5">
                  {t.lastMessage
                    ? `${t.lastMessage.fromSupport ? "Support : " : ""}${t.lastMessage.content}`
                    : "—"}
                </span>
                <span className="block text-[11px] text-outline mt-1">
                  {STATUS_LABELS[t.status] ?? t.status} ·{" "}
                  {new Date(t.lastMessageAt).toLocaleDateString("fr-FR")}
                </span>
              </span>
              {t.unreadForUser > 0 && (
                <span className="shrink-0 rounded-full bg-primary text-white text-[10px] font-bold px-2 py-0.5">
                  {t.unreadForUser}
                </span>
              )}
            </div>
          </button>
        ))}

        {!loading && tickets.length === 0 && (
          <p className="text-sm text-outline px-1">Aucune demande pour l&apos;instant.</p>
        )}
      </aside>

      {/* Conversation, ou formulaire d'ouverture */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5 min-h-[420px] flex flex-col">
        {error && (
          <p className="mb-3 rounded-xl bg-rose-50 border border-rose-100 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        )}

        {composing || (!active && !loading) ? (
          <form onSubmit={create} className="space-y-3">
            <h2 className="text-lg font-extrabold font-['Manrope']">Écrire au support</h2>
            <p className="text-sm text-outline">
              Une vraie personne vous répond. Vous recevez sa réponse ici, par notification et par
              email.
            </p>

            <label className="block text-xs font-semibold text-outline">
              Sujet
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex. Je n'arrive pas à publier une annonce"
                className={input}
                required
              />
            </label>

            <label className="block text-xs font-semibold text-outline">
              Rubrique
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold text-outline">
              Votre message
              <textarea
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                rows={6}
                placeholder="Décrivez ce qui se passe. Plus c'est précis, plus la réponse est rapide."
                className={input}
                required
              />
            </label>

            <button
              type="submit"
              disabled={sending}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {sending ? "Envoi…" : "Envoyer"}
            </button>
          </form>
        ) : active ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold font-['Manrope'] truncate">{active.subject}</h2>
                <p className="text-xs text-outline mt-0.5">
                  {STATUS_LABELS[active.status] ?? active.status} · ouverte le{" "}
                  {new Date(active.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              {active.status !== "RESOLVED" && active.status !== "CLOSED" && (
                <button
                  type="button"
                  onClick={resolve}
                  className="shrink-0 text-xs font-bold text-outline hover:text-primary"
                >
                  C&apos;est réglé
                </button>
              )}
            </div>

            <div ref={threadRef} className="flex-1 overflow-y-auto py-4 space-y-3">
              {active.messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    m.fromSupport
                      ? "bg-surface-container-low text-on-surface"
                      : "bg-primary text-white ml-auto"
                  }`}
                >
                  {m.content && <p className="text-sm whitespace-pre-wrap">{m.content}</p>}
                  {m.attachmentUrl && (
                    <a
                      href={m.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-2 block overflow-hidden rounded-xl ${
                        m.fromSupport ? "bg-white" : "bg-white/15"
                      }`}
                    >
                      {m.attachmentType?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.attachmentUrl}
                          alt={m.attachmentName ?? "Pièce jointe"}
                          className="max-h-56 w-full object-cover"
                        />
                      ) : (
                        <span className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold">
                          <span className="material-symbols-outlined text-[20px]">description</span>
                          <span className="truncate">{m.attachmentName ?? "Document"}</span>
                        </span>
                      )}
                    </a>
                  )}
                  <p
                    className={`text-[10px] mt-1 ${m.fromSupport ? "text-outline" : "text-white/70"}`}
                  >
                    {m.fromSupport ? "Support Deal&Co" : "Vous"} ·{" "}
                    {new Date(m.createdAt).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ))}
            </div>

            <form onSubmit={send} className="border-t border-slate-100 pt-3 space-y-2">
              {attachment && (
                <div className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-sm">
                  <span className="material-symbols-outlined text-[18px] text-primary">attach_file</span>
                  <span className="truncate flex-1 font-semibold">{attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="text-outline hover:text-[#ba1a1a]"
                    aria-label="Retirer la pièce jointe"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label
                  className="shrink-0 grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-slate-200 text-outline hover:border-primary hover:text-primary"
                  title="Joindre une photo ou un PDF"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {attaching ? "hourglass_empty" : "attach_file"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void attach(f);
                    }}
                  />
                  <span className="sr-only">Joindre un fichier</span>
                </label>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder="Votre message…"
                  className={input}
                />
                <button
                  type="submit"
                  disabled={sending || attaching || (!reply.trim() && !attachment)}
                  className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Envoyer
                </button>
              </div>
              <p className="text-[11px] text-outline">
                Photos et PDF acceptés, 10 Mo maximum. Vos documents ne sont visibles que par vous
                et par l&apos;équipe support.
              </p>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}
