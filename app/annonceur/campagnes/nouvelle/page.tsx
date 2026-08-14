import { redirect } from "next/navigation";
import Link from "next/link";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import AdvertiserShell from "../../AdvertiserShell";
import CampaignWizard from "./CampaignWizard";

export const dynamic = "force-dynamic";

/** Création d'une campagne, en six étapes. */
export default async function NewCampaignPage() {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) redirect("/annonceur/connexion");
  if (advertiser.mustChangePassword) redirect("/annonceur/mot-de-passe");

  return (
    <AdvertiserShell
      title="Nouvelle campagne"
      subtitle="Six étapes, et vous voyez votre publicité avant de la lancer."
      advertiserName={advertiser.company || `${advertiser.firstName} ${advertiser.lastName}`}
      contactName={`${advertiser.firstName} ${advertiser.lastName}`}
      current="/annonceur/campagnes"
    >
      <div className="max-w-5xl">
        <Link href="/annonceur/campagnes" className="text-sm font-bold" style={{ color: "#94A3B8" }}>
          ← Retour aux campagnes
        </Link>
        <div className="mt-4">
          <CampaignWizard />
        </div>
      </div>
    </AdvertiserShell>
  );
}
