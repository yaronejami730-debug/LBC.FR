import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import { buildPrivateMetadata } from "@/lib/seo/metadata";
import { CATEGORIES } from "@/lib/categories";
import { DRAFT_KEEP_DAYS } from "@/lib/drafts";
import DeleteDraftButton from "./DeleteDraftButton";

/**
 * Brouillon de dépôt du compte connecté.
 *
 * Le formulaire s'enregistre tout seul, mais tant que cet enregistrement
 * n'avait pas de page à lui, le vendeur n'avait aucun moyen de vérifier que sa
 * saisie existait encore — les emails de relance annonçaient un brouillon
 * qu'aucun écran ne montrait.
 *
 * Un seul brouillon par compte (`Draft.userId` est unique) : commencer une
 * nouvelle annonce écrase la précédente, ce que la page dit explicitement.
 */
export const metadata = buildPrivateMetadata(
  "Mes brouillons",
  "Reprenez l'annonce que vous n'avez pas terminé de publier.",
);
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BrouillonsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/brouillons");

  const draft = await prisma.draft.findUnique({
    where: { userId: session.user.id as string },
    select: { payload: true, category: true, completeness: true, updatedAt: true },
  });

  let title: string | null = null;
  if (draft) {
    try {
      const parsed = JSON.parse(draft.payload) as { title?: unknown };
      if (typeof parsed.title === "string" && parsed.title.trim()) title = parsed.title.trim();
    } catch {
      /* brouillon illisible — on affiche la fiche sans titre */
    }
  }

  const category = draft ? CATEGORIES.find((c) => c.id === draft.category) ?? null : null;
  const deleteOn = draft ? new Date(draft.updatedAt.getTime() + DRAFT_KEEP_DAYS * DAY_MS) : null;

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-24">
        <h1 className="text-2xl font-extrabold text-on-surface">Mes brouillons</h1>
        <p className="mt-1 text-sm text-outline">
          Une annonce commencée mais non publiée est conservée ici {DRAFT_KEEP_DAYS} jours.
        </p>

        {!draft ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300">draft</span>
            <p className="mt-2 font-bold text-on-surface">Aucun brouillon en cours</p>
            <p className="mt-1 text-sm text-outline">
              Vos annonces non terminées apparaîtront ici automatiquement.
            </p>
            <Link href="/post"
              className="mt-5 inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-white">
              Déposer une annonce
            </Link>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Brouillon</p>
            <p className="mt-1 text-lg font-extrabold text-on-surface">
              {title ?? <span className="italic text-outline">Annonce sans titre</span>}
            </p>
            {category && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-outline">
                <span className="material-symbols-outlined text-base text-primary">{category.icon}</span>
                {category.label}
              </p>
            )}

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-outline">
                <span>Complété</span>
                <span className="tabular-nums">{draft.completeness} %</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, draft.completeness))}%` }} />
              </div>
            </div>

            <p className="mt-4 text-xs text-outline">
              Enregistré le {formatDate(draft.updatedAt)} · supprimé automatiquement le{" "}
              {deleteOn ? formatDate(deleteOn) : "—"}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/post"
                className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white">
                Reprendre mon annonce
              </Link>
              <DeleteDraftButton />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
