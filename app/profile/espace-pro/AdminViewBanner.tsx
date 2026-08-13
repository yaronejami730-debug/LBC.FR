import Link from "next/link";

/**
 * Bandeau « vue administrateur ».
 *
 * Un administrateur de la plateforme peut ouvrir n'importe quelle boutique pour
 * instruire un dossier. Il y a alors tous les droits : sans ce bandeau, rien à
 * l'écran ne distingue « ma boutique » de « la boutique de quelqu'un d'autre »,
 * et une modification faite par mégarde passerait pour une action du
 * professionnel.
 */
export default function AdminViewBanner({
  establishmentName,
  ownerEmail,
}: {
  establishmentName: string;
  ownerEmail?: string | null;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
      <span className="min-w-0">
        <strong className="font-extrabold">Vue administrateur</strong> — vous consultez{" "}
        {establishmentName}
        {ownerEmail ? ` (${ownerEmail})` : ""}. Vos modifications s&apos;appliquent à ce
        professionnel.
      </span>
      <Link
        href="/admin/professionnels"
        title="Retour à la modération des professionnels"
        className="ml-auto font-bold underline whitespace-nowrap"
      >
        Retour à l&apos;admin
      </Link>
    </div>
  );
}
