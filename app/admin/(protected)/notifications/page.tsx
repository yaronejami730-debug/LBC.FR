import { getCampaignCounts } from "@/app/admin/actions";
import NotificationsHub from "@/components/admin/NotificationsHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications — Admin" };

export default async function NotificationsPage() {
  const counts = await getCampaignCounts();
  return <NotificationsHub counts={counts} />;
}
