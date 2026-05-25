import { getCampaignCounts, getPushAudienceCount } from "@/app/admin/actions";
import NotificationsHub from "@/components/admin/NotificationsHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications — Admin" };

export default async function NotificationsPage() {
  const [counts, pushAudience] = await Promise.all([getCampaignCounts(), getPushAudienceCount()]);
  return <NotificationsHub counts={counts} pushAudience={pushAudience} />;
}
