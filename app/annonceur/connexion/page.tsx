import { redirect } from "next/navigation";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import AdvertiserLoginForm from "./LoginForm";
import AuthCard from "../AuthCard";

export const dynamic = "force-dynamic";

/** Connexion à l'espace annonceur. */
export default async function AdvertiserLoginPage() {
  // Déjà connecté : on n'affiche pas un formulaire de connexion à quelqu'un
  // qui l'a déjà rempli.
  const advertiser = await requireActiveAdvertiser();
  if (advertiser) redirect(advertiser.mustChangePassword ? "/annonceur/mot-de-passe" : "/annonceur");

  return (
    <AuthCard
      title="Espace annonceur"
      intro="Connectez-vous avec les accès reçus par e-mail. Ils vous ont été remis par l'équipe Deal&Co."
    >
      <AdvertiserLoginForm />
    </AuthCard>
  );
}
