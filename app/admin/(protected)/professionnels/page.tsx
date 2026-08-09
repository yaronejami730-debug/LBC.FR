import { prisma } from "@/lib/prisma";
import ProAccountRow from "./ProAccountRow";
import ModeratorForm from "./ModeratorForm";

export const metadata = { title: "Professionnels — Admin" };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "ALL", label: "Tous" },
  { value: "APPROVED", label: "Vérifiés" },
  { value: "NONE", label: "Non vérifiés" },
  { value: "PENDING", label: "En attente" },
  { value: "INFO_REQUESTED", label: "Infos demandées" },
  { value: "REJECTED", label: "Refusés" },
  { value: "SUSPENDED", label: "Suspendus" },
];

/**
 * Tous les comptes professionnels présents sur la plateforme — pas seulement
 * les dossiers déposés.
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
  const filter = TABS.some((t) => t.value === statut) ? statut! : "ALL";
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
        _count: { select: { listings: true } },
        proProfile: { select: { slug: true, isPublished: true, _count: { select: { services: true } } } },
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
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Professionnels</h1>
        <p className="text-slate-500 mt-1">
          Tous les comptes professionnels de la plateforme. Même traitement que la validation des
          annonces : vérifier, demander des informations, refuser, suspendre.
        </p>
      </div>

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
            {t.label} ({t.value === "ALL" ? total : (byStatus[t.value] ?? 0)})
          </a>
        ))}
      </div>

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
