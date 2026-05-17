import { getCampaignCounts } from "@/app/admin/actions";
import CampaignForm from "@/components/admin/CampaignForm";

export const dynamic = "force-dynamic";

export default async function NotificationsMailPage() {
  const counts = await getCampaignCounts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">
          Notifications par mail
        </h1>
        <p className="text-sm text-[#777683] mt-1">
          Créez et envoyez une campagne email manuelle à un segment d&apos;utilisateurs.
        </p>
      </div>

      <CampaignForm counts={counts} />
    </div>
  );
}
