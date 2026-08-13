import { prisma } from "@/lib/prisma";
import ProAccountRow from "./ProAccountRow";
import ModeratorForm from "./ModeratorForm";
import VerificationCard, { type Compte } from "../verifications-pro/VerificationCard";

export const metadata = { title: "Professionnels — Admin" };
export const dynamic = "force-dynamic";

// Une seule section pour la modération professionnelle : les demandes à
// instruire et les comptes déjà en ligne. Un modérateur n'a pas à se demander
// dans quel écran chercher.
const TABS = [
  { value: "PENDING", label: "À vérifier" },
  { value: "INFO_REQUESTED", label: "Infos demandées" },
  { value: "APPROVED", label: "Vérifiés" },
  { value: "REJECTED", label: "Refusés" },
  { value: "SUSPENDED", label: "Suspendus" },
  { value: "NONE", label: "Non vérifiés" },
  { value: "ALL", label: "Tous" },
];

/** Onglets qui affichent la demande complète (pièces, historique, décisions). */
const REQUEST_TABS = new Set(["PENDING", "INFO_REQUESTED"]);

/**
 * Tous les comptes professionnels présents sur la plateforme — pas seulement
 * ceux qui ont envoyé une demande.
 *
 * Beaucoup de comptes sont passés « pro » avant l'existence de la
 * vérification : ce sont eux qu'il faut pouvoir reprendre un par un. D'où le
 * filtre « Non vérifiés », qui isole les `isPro` sans habilitation.
 */
export default async function ProfessionnelsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string }>;
}) {
  const { statut, q } = await searchParams;
  const filter = TABS.some((t) => t.value === statut) ? statut! : "PENDING";
  const search = (q ?? "").trim();

  const base = {
    OR: [{ isPro: true }, { professionalStatus: { not: "NONE" } }, { siret: { not: null } }],
  };

  const where: Record<string, unknown> = {
    AND: [
      base,
      filter === "ALL" ? {} : { professionalStatus: filter },
      search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
              { siret: { contains: search } },
            ],
          }
        : {},
    ],
  };

  // Les onglets d'instruction montrent la demande elle-même : entreprise,
  // responsable, pièces justificatives, historique, actions de modération.
  if (REQUEST_TABS.has(filter)) {
    const [requests, statusCounts] = await Promise.all([
      prisma.proVerification.findMany({
        where: { status: filter },
        orderBy: { submittedAt: "asc" },
        take: 200,
        include: {
          logs: { orderBy: { createdAt: "desc" }, take: 20 },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
              isPro: true,
              phoneNumber: true,
              emailVerified: true,
              phoneVerified: true,
              professionalStatus: true,
              _count: { select: { listings: true } },
            },
          },
        },
      }),
      prisma.user.groupBy({
        by: ["professionalStatus"],
        where: base as never,
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(statusCounts.map((c) => [c.professionalStatus, c._count._all]));

    return (
      <div className="space-y-6">
        <Header />
        <ModeratorForm />
        <Tabs filter={filter} counts={counts} search="" />

        {requests.length === 0 ? (
          <p className="bg-white border border-[#eceef0] rounded-2xl px-6 py-10 text-center text-slate-400 font-medium">
            Aucune demande dans cette file.
          </p>
        ) : (
          <div className="space-y-4">
            {requests.map((r) => (
              <VerificationCard key={r.id} compte={JSON.parse(JSON.stringify(r)) as Compte} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const [accounts, counts] = await Promise.all([
    prisma.user.findMany({
      where: where as never,
      // Ordre alphabétique : on cherche un salon par son nom, pas par sa date
      // d'inscription.
      orderBy: [{ companyName: "asc" }, { name: "asc" }],
      take: 300,
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        siret: true,
        isPro: true,
        role: true,
        professionalStatus: true,
        proVerifiedAt: true,
        createdAt: true,
        emailVerified: true,
        phoneVerified: true,
        bannedAt: true,
        verified: true,
        _count: { select: { listings: true } },
        // Depuis le multi-établissement, un compte porte *plusieurs* fiches :
        // la relation `proProfile` n'existe plus. La garder faisait échouer la
        // requête, donc planter tous les onglets qui listent des comptes —
        // « Vérifiés », « Refusés », « Suspendus », « Non vérifiés », « Tous ».
        proProfiles: {
          orderBy: { createdAt: "asc" },
          select: { id: true, slug: true, isPublished: true, _count: { select: { services: true } } },
        },
      },
    }),
    prisma.user.groupBy({
      by: ["professionalStatus"],
      where: base as never,
      _count: { _all: true },
    }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.professionalStatus, c._count._all]));
  const total = counts.reduce((s, c) => s + c._count._all, 0);

  return (
    <div className="space-y-6">
      <Header />
      <ModeratorForm />

      <form method="get" className="flex flex-wrap gap-2">
        <input type="hidden" name="statut" value={filter} />
        <input
          name="q"
          defaultValue={search}
          placeholder="Rechercher un nom, un email, une enseigne, un SIRET…"
          className="flex-1 min-w-[240px] rounded-xl border border-[#eceef0] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/20"
        />
        <button
          type="submit"
          className="rounded-full bg-[#2f6fb8] px-5 py-2.5 text-sm font-bold text-white"
        >
          Rechercher
        </button>
      </form>

      <Tabs filter={filter} counts={byStatus} search={search} total={total} />

      {accounts.length === 0 ? (
        <p className="bg-white border border-[#eceef0] rounded-2xl px-6 py-10 text-center text-slate-400 font-medium">
          Aucun compte dans cette file.
        </p>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => (
            <ProAccountRow key={a.id} account={JSON.parse(JSON.stringify(a))} />
          ))}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900">Professionnels</h1>
      <p className="text-slate-500 mt-1">
        Demandes à instruire et comptes déjà en ligne, au même endroit : vérifier, demander des
        informations, refuser, suspendre, supprimer.
      </p>
    </div>
  );
}

function Tabs({
  filter,
  counts,
  search,
  total,
}: {
  filter: string;
  counts: Record<string, number>;
  search: string;
  total?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((t) => (
        <a
          key={t.value}
          href={`/admin/professionnels?statut=${t.value}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
            filter === t.value
              ? "bg-[#2f6fb8] text-white"
              : "bg-white text-slate-500 border border-[#eceef0] hover:border-[#2f6fb8]"
          }`}
        >
          {t.label} (
          {t.value === "ALL"
            ? (total ?? Object.values(counts).reduce((a, b) => a + b, 0))
            : (counts[t.value] ?? 0)}
          )
        </a>
      ))}
    </div>
  );
}
