import Link from "next/link";

/**
 * Accès au support depuis la messagerie.
 *
 * Placé au-dessus des conversations, et toujours visible même sans discussion
 * en cours : quelqu'un qui a un problème ouvre ses messages, pas les réglages
 * de son profil. L'interlocuteur est « Support Deal&Co » — jamais le nom de la
 * personne qui répond.
 */
export default function SupportEntry({
  ticket,
}: {
  ticket: {
    id: string;
    subject: string;
    unread: number;
    lastMessageAt: string;
    preview: string;
    fromSupport: boolean;
  } | null;
}) {
  const when = ticket
    ? new Date(ticket.lastMessageAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
    : null;

  return (
    <Link
      href={ticket ? `/messages/support?t=${ticket.id}` : "/messages/support"}
      className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 hover:border-primary/40 transition-colors"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <span className="material-symbols-outlined">support_agent</span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-bold truncate">Support Deal&amp;Co</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            Équipe
          </span>
        </span>
        <span className="block truncate text-sm text-outline">
          {ticket
            ? `${ticket.fromSupport ? "" : "Vous : "}${ticket.preview || ticket.subject}`
            : "Une question, un souci ? Écrivez-nous, on répond vite."}
        </span>
      </span>

      {ticket && ticket.unread > 0 ? (
        <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
          {ticket.unread}
        </span>
      ) : (
        when && <span className="shrink-0 text-xs text-outline">{when}</span>
      )}
    </Link>
  );
}
