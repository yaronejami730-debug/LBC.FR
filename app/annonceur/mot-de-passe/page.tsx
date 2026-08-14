import { redirect } from "next/navigation";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import ChangePasswordForm from "./ChangePasswordForm";
import AuthCard from "../AuthCard";

export const dynamic = "force-dynamic";

/**
 * Passage obligatoire de la première connexion.
 *
 * Le mot de passe reçu par e-mail a circulé en clair dans une boîte de
 * réception : tant qu'il n'est pas remplacé, le compte ne s'ouvre pas. La page
 * reste accessible ensuite pour un changement volontaire.
 */
export default async function AdvertiserPasswordPage() {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) redirect("/annonceur/connexion");

  const forced = advertiser.mustChangePassword;

  return (
    <AuthCard
      title={forced ? "Sécurisez votre compte" : "Changer mon mot de passe"}
      intro={
        forced
          ? "Votre mot de passe actuel est temporaire : il a transité par e-mail. Choisissez le vôtre maintenant."
          : "Choisissez un nouveau mot de passe pour votre espace annonceur."
      }
    >
      <ChangePasswordForm forced={forced} />
    </AuthCard>
  );
}
