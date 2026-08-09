import { prisma } from "@/lib/prisma";
import VerificationCard, { type Dossier } from "./VerificationCard";

export const metadata = { title: "Vérifications pro — Admin" };
export const dynamic = "force-dynamic";

const STATUSES = [
  { value: "PENDING", label: "À vérifier" },
  { value: "INFO_REQUESTED", label: "Infos demandées" },
  { value: "APPROVED", label: "Vérifiés" },
  { value: "REJECTED", label: "Refusés" },
  { value: "SUSPENDED", label: "Suspendus" },
];

export default async function VerificationsProPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut } = await searchParams;
  const filter = STATUSES.some((s) => s.value === statut) ? statut : "PENDING";

  const [dossiers, counts] = await Promise.all([
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
    prisma.proVerification.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  // Promesse affichée à l'utilisateur : réponse sous 24 à 48 h.
  const lateCutoff = Date.now() - 48 * 3_600_000;
  const late = dossiers.filter(
    (d) => d.status === "PENDING" && d.submittedAt.getTime() < lateCutoff,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Vérifications pro</h1>
        <p className="text-slate-500 mt-1">
          Pièce d&apos;identité + justificatif d&apos;entreprise. Le compte ne passe professionnel
          qu&apos;après validation ici.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="À vérifier" value={countByStatus.PENDING ?? 0} />
        <Stat label="Vérifiés" value={countByStatus.APPROVED ?? 0} tone="good" />
        <Stat label="Suspendus" value={countByStatus.SUSPENDED ?? 0} tone={countByStatus.SUSPENDED ? "bad" : undefined} />
        <Stat label="Hors délai 48 h" value={late} tone={late > 0 ? "bad" : undefined} />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <a
            key={s.value}
            href={`/admin/verifications-pro?statut=${s.value}`}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              filter === s.value
                ? "bg-[#2f6fb8] text-white"
                : "bg-white text-slate-500 border border-[#eceef0] hover:border-[#2f6fb8]"
            }`}
          >
            {s.label} ({countByStatus[s.value] ?? 0})
          </a>
        ))}
      </div>

      {dossiers.length === 0 ? (
        <p className="bg-white border border-[#eceef0] rounded-2xl px-6 py-10 text-center text-slate-400 font-medium">
          Aucun dossier dans cette file.
        </p>
      ) : (
        <div className="space-y-4">
          {dossiers.map((d) => (
            <VerificationCard key={d.id} dossier={d as unknown as Dossier} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="bg-white border border-[#eceef0] rounded-2xl px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
