import { redirect } from "next/navigation";

/**
 * La vérification professionnelle a été fusionnée avec la gestion des comptes
 * professionnels : une seule file, un seul écran. Cette route ne sert plus
 * qu'à ne pas casser les liens existants (emails admin, favoris).
 */
export default async function VerificationsProRedirect({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut } = await searchParams;
  redirect(`/admin/professionnels${statut ? `?statut=${statut}` : ""}`);
}
