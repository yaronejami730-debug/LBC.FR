import { prisma } from "@/lib/prisma";
import ExternalSourceForm from "@/components/admin/ExternalSourceForm";
import ExternalSourceRow from "@/components/admin/ExternalSourceRow";
import SingleListingImport from "@/components/admin/SingleListingImport";

export const dynamic = "force-dynamic";

export default async function SourcesExternesPage() {
  const rows = await prisma.externalSource.findMany({
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true, email: true } } },
  });

  const sources = rows.map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind,
    url: r.url,
    domain: (r as any).domain ?? null,
    agencySlug: (r as any).agencySlug ?? null,
    active: r.active,
    lastSyncedAt: r.lastSyncedAt,
    lastResult: r.lastResult,
    ownerEmail: r.owner.email,
    ownerName: r.owner.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">Sources externes</h1>
        <p className="text-sm text-[#777683] mt-1">
          Importez les annonces d&apos;un site externe vers Deal &amp; Co. Cliquez sur
          « Synchroniser » pour déclencher manuellement un import.
        </p>
      </div>

      <SingleListingImport />

      <ExternalSourceForm />

      <div className="space-y-3">
        {sources.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#eceef0] py-16 text-center">
            <span
              className="material-symbols-outlined text-5xl text-[#c7c5d4]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              import_export
            </span>
            <p className="text-[#777683] mt-2">Aucune source configurée.</p>
          </div>
        ) : (
          sources.map((s) => <ExternalSourceRow key={s.id} source={s} />)
        )}
      </div>
    </div>
  );
}
